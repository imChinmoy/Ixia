import { describe, it, expect } from 'vitest';
import {
  ConversationManager,
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@ixia/core';
import { ToolRegistry, ToolExecutor, type Tool, type ToolExecutionContext, type ToolSchema } from '@ixia/tools';
import {
  AgentRuntime,
  AgentBusyError,
  AgentIterationLimitError,
  AgentToolCallLimitError,
  type AgentEvent,
} from '@ixia/agent';

class ScriptableLLMProvider implements LLMProvider {
  readonly name = 'scriptable-mock';
  readonly model = 'mock-model';
  private turns: Array<(messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>>;
  public calls: Array<{ messages: Message[]; options?: LLMRequestOptions }> = [];

  constructor(
    turns: Array<(messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>>,
  ) {
    this.turns = [...turns];
  }

  async *stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    this.calls.push({ messages: [...messages], options });
    const turnFn = this.turns.shift();
    if (!turnFn) {
      yield { type: 'text_delta', content: 'No more scripted turns.' };
      yield { type: 'completed' };
      return;
    }
    yield* turnFn(messages, options);
  }
}

class EchoTool implements Tool<{ text: string }, { echoed: string }> {
  readonly name = 'echo_tool';
  readonly description = 'Echoes back text';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to echo' },
    },
    required: ['text'],
  };

  async execute(
    input: { text: string },
    _context: ToolExecutionContext,
  ): Promise<{ echoed: string }> {
    return { echoed: input.text };
  }
}

class FailingTool implements Tool<Record<string, unknown>, never> {
  readonly name = 'failing_tool';
  readonly description = 'Always fails';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {},
  };

  async execute(): Promise<never> {
    throw new Error('Explosion in failing_tool');
  }
}

describe('AgentRuntime & AgentLoop (Phase 7)', () => {
  it('should complete in a single turn when LLM produces direct text with no tool calls', async () => {
    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        yield { type: 'text_delta', content: 'Hello! ' };
        yield { type: 'text_delta', content: 'How can I help?' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Hi there');

    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello! How can I help?');
    expect(result.iterations).toBe(1);
    expect(result.toolCallsCount).toBe(0);
    expect(agent.getState()).toBe('completed');

    // Verify conversation manager messages
    const messages = cm.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toBe('Hi there');
    expect(messages[1]?.role).toBe('assistant');
    expect(messages[1]?.content).toBe('Hello! How can I help?');
  });

  it('should execute a tool call and feed the result back to the LLM for a final response', async () => {
    const mockProvider = new ScriptableLLMProvider([
      // Turn 1: request echo_tool
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call_1',
            name: 'echo_tool',
            arguments: { text: 'Ixia is active' },
          },
        };
        yield { type: 'completed' };
      },
      // Turn 2: inspect result and answer
      async function* (messages: Message[]) {
        const lastMsg = messages[messages.length - 1];
        expect(lastMsg?.role).toBe('tool');
        expect(lastMsg?.toolCallId).toBe('call_1');
        expect(lastMsg?.content).toContain('Ixia is active');

        yield { type: 'text_delta', content: 'The tool returned: Ixia is active.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream('Run echo tool')) {
      events.push(event);
    }

    expect(events.map((e) => e.type)).toEqual([
      'agent_started',
      'iteration_started',
      'llm_started',
      'tool_call_started',
      'tool_call_completed',
      'iteration_started',
      'llm_started',
      'llm_text_delta',
      'agent_completed',
    ]);

    // Check conversation history
    const msgs = cm.getMessages();
    expect(msgs).toHaveLength(4);
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[1]?.role).toBe('assistant');
    expect(msgs[1]?.toolCalls).toBeDefined();
    expect(msgs[1]?.toolCalls?.[0]?.name).toBe('echo_tool');
    expect(msgs[2]?.role).toBe('tool');
    expect(msgs[2]?.toolName).toBe('echo_tool');
    expect(msgs[2]?.content).toContain('Ixia is active');
    expect(msgs[3]?.role).toBe('assistant');
    expect(msgs[3]?.content).toBe('The tool returned: Ixia is active.');
  });

  it('should handle multi-step tool calls across multiple iterations', async () => {
    const mockProvider = new ScriptableLLMProvider([
      // Turn 1
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'c1', name: 'echo_tool', arguments: { text: 'step 1' } },
        };
        yield { type: 'completed' };
      },
      // Turn 2
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'c2', name: 'echo_tool', arguments: { text: 'step 2' } },
        };
        yield { type: 'completed' };
      },
      // Turn 3: final answer
      async function* () {
        yield { type: 'text_delta', content: 'Completed both steps.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Execute steps');

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(3);
    expect(result.toolCallsCount).toBe(2);
    expect(result.output).toBe('Completed both steps.');
  });

  it('should execute multiple tool calls in a single turn', async () => {
    const mockProvider = new ScriptableLLMProvider([
      // Turn 1: 2 parallel tool calls
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'call_a', name: 'echo_tool', arguments: { text: 'Alpha' } },
        };
        yield {
          type: 'tool_call',
          toolCall: { id: 'call_b', name: 'echo_tool', arguments: { text: 'Beta' } },
        };
        yield { type: 'completed' };
      },
      // Turn 2
      async function* (messages: Message[]) {
        const toolMessages = messages.filter((m) => m.role === 'tool');
        expect(toolMessages).toHaveLength(2);
        expect(toolMessages[0]?.content).toContain('Alpha');
        expect(toolMessages[1]?.content).toContain('Beta');

        yield { type: 'text_delta', content: 'Both Alpha and Beta received.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Run both in parallel');

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.toolCallsCount).toBe(2);
    expect(result.output).toBe('Both Alpha and Beta received.');
  });

  it('should recover when a tool throws an error, feeding error back to the LLM', async () => {
    const mockProvider = new ScriptableLLMProvider([
      // Turn 1: request failing_tool
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'call_err', name: 'failing_tool', arguments: {} },
        };
        yield { type: 'completed' };
      },
      // Turn 2: observe failure and inform user
      async function* (messages: Message[]) {
        const toolMsg = messages.find((m) => m.role === 'tool');
        expect(toolMsg?.content).toContain('Explosion in failing_tool');

        yield {
          type: 'text_delta',
          content: 'The tool failed with an error, but I recovered safely.',
        };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new FailingTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream('Trigger failure')) {
      events.push(event);
    }

    const failedEvent = events.find((e) => e.type === 'tool_call_failed');
    expect(failedEvent).toBeDefined();
    if (failedEvent && failedEvent.type === 'tool_call_failed') {
      expect(failedEvent.error.message).toContain('Explosion in failing_tool');
    }

    const completedEvent = events.find((e) => e.type === 'agent_completed');
    expect(completedEvent).toBeDefined();
    if (completedEvent && completedEvent.type === 'agent_completed') {
      expect(completedEvent.output).toBe(
        'The tool failed with an error, but I recovered safely.',
      );
    }
  });

  it('should feed back error when LLM calls an unknown tool', async () => {
    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'c_unknown', name: 'non_existent_tool', arguments: {} },
        };
        yield { type: 'completed' };
      },
      async function* (messages: Message[]) {
        const toolMsg = messages.find((m) => m.role === 'tool');
        expect(toolMsg?.content).toContain('non_existent_tool');

        yield { type: 'text_delta', content: 'I see that tool is not available.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Call non-existent tool');
    expect(result.success).toBe(true);
    expect(result.output).toBe('I see that tool is not available.');
  });

  it('should feed back error when tool arguments fail schema validation', async () => {
    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        yield {
          type: 'tool_call',
          // missing required 'text' field
          toolCall: { id: 'c_invalid', name: 'echo_tool', arguments: { wrong: 123 } },
        };
        yield { type: 'completed' };
      },
      async function* (messages: Message[]) {
        const toolMsg = messages.find((m) => m.role === 'tool');
        expect(toolMsg?.content).toContain('text');

        yield { type: 'text_delta', content: 'Fixed missing argument error.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Test schema validation error');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Fixed missing argument error.');
  });

  it('should enforce maxIterations limit', async () => {
    // Provider keeps returning tool calls endlessly
    const infiniteCalls = Array(10).fill(() =>
      (async function* () {
        yield {
          type: 'tool_call',
          toolCall: { id: 'call_loop', name: 'echo_tool', arguments: { text: 'ping' } },
        };
        yield { type: 'completed' };
      })(),
    );

    const mockProvider = new ScriptableLLMProvider(infiniteCalls);
    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      config: { maxIterations: 3 },
    });

    const result = await agent.run('Infinite tool loop');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(AgentIterationLimitError);
    expect(result.error?.message).toContain('3');
    expect(agent.getState()).toBe('failed');
  });

  it('should enforce maxToolCalls limit across execution', async () => {
    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        // Returns 4 tool calls in one turn, but limit is 2
        yield { type: 'tool_call', toolCall: { id: '1', name: 'echo_tool', arguments: { text: 'a' } } };
        yield { type: 'tool_call', toolCall: { id: '2', name: 'echo_tool', arguments: { text: 'b' } } };
        yield { type: 'tool_call', toolCall: { id: '3', name: 'echo_tool', arguments: { text: 'c' } } };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      config: { maxToolCalls: 2 },
    });

    const result = await agent.run('Too many tool calls');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(AgentToolCallLimitError);
    expect(result.error?.message).toContain('2');
  });

  it('should support cancellation via AbortSignal', async () => {
    const abortController = new AbortController();

    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        abortController.abort('User cancelled');
        yield { type: 'text_delta', content: 'Streaming before abort' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('Cancel test', { signal: abortController.signal });

    expect(result.cancelled).toBe(true);
    expect(result.success).toBe(false);
    expect(agent.getState()).toBe('cancelled');
  });

  it('should support cancellation via agent.cancel()', async () => {
    const handle = { agent: undefined as AgentRuntime | undefined };

    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        handle.agent?.cancel('Manual cancel');
        yield { type: 'text_delta', content: 'About to be cancelled' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });
    handle.agent = agent;

    const result = await agent.run('Test manual cancel');

    expect(result.cancelled).toBe(true);
    expect(agent.getState()).toBe('cancelled');
  });

  it('should prevent concurrent executions by throwing AgentBusyError', async () => {
    let resolveFirstTurn!: () => void;
    const blocker = new Promise<void>((res) => {
      resolveFirstTurn = res;
    });

    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        await blocker;
        yield { type: 'text_delta', content: 'Finished first' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    // Start first run
    const firstRunPromise = agent.run('Run 1');

    // Attempt second run while first is in-flight
    await expect(agent.run('Run 2')).rejects.toThrow(AgentBusyError);

    resolveFirstTurn();
    const firstResult = await firstRunPromise;
    expect(firstResult.success).toBe(true);
  });

  it('should ignore empty or whitespace-only inputs', async () => {
    const mockProvider = new ScriptableLLMProvider([]);
    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
    });

    const result = await agent.run('   ');
    expect(result.success).toBe(false);
    expect(result.iterations).toBe(0);
    expect(cm.getMessages()).toHaveLength(0);
  });
});
