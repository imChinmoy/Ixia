import { describe, it, expect } from 'vitest';
import {
  ConversationManager,
  type LLMProvider,
  type LLMEvent,
  type LLMRequestOptions,
  type Message,
} from '@ixia/core';
import {
  ToolRegistry,
  ToolExecutor,
  type Tool,
  type ToolExecutionContext,
  type ToolSchema,
} from '@ixia/tools';
import { AgentRuntime, type AgentEvent } from '@ixia/agent';
import { PlannerService } from '@ixia/planner';

class ScriptableLLMProvider implements LLMProvider {
  readonly name = 'scriptable-mock';
  readonly model = 'mock-model';
  private turns: Array<
    (messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>
  >;
  public calls: Array<{ messages: Message[]; options?: LLMRequestOptions }> = [];

  constructor(
    turns: Array<
      (messages: Message[], options?: LLMRequestOptions) => AsyncIterable<LLMEvent>
    >,
  ) {
    this.turns = [...turns];
  }

  async *stream(
    messages: Message[],
    options?: LLMRequestOptions,
  ): AsyncIterable<LLMEvent> {
    this.calls.push({ messages: [...messages], options });
    const turnFn = this.turns.shift();
    if (!turnFn) {
      yield { type: 'text_delta', content: 'Fallback response' };
      yield { type: 'completed' };
      return;
    }
    yield* turnFn(messages, options);
  }
}

class EchoTool implements Tool<{ text: string }, { echoed: string }> {
  readonly name = 'echo_tool';
  readonly description = 'Echoes text';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      text: { type: 'string' },
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

describe('AgentRuntime with PlannerService Integration (Phase 9)', () => {
  it('executes a complex task step-by-step using a generated plan', async () => {
    const planJson = JSON.stringify({
      goal: 'Refactor authentication service and add unit tests',
      steps: [
        {
          id: 'step-1',
          title: 'Review existing auth structure',
          description: 'Inspect types and interfaces',
          dependencies: [],
        },
        {
          id: 'step-2',
          title: 'Implement token verification logic',
          description: 'Add JWT verify function',
          dependencies: ['step-1'],
        },
      ],
    });

    const mockProvider = new ScriptableLLMProvider([
      // 1. Planner Turn: returns JSON plan
      async function* () {
        yield { type: 'text_delta', content: planJson };
        yield { type: 'completed' };
      },
      // 2. Step 1 execution in AgentLoop
      async function* () {
        yield {
          type: 'text_delta',
          content: 'Step 1 complete: Reviewed auth structure.',
        };
        yield { type: 'completed' };
      },
      // 3. Step 2 execution in AgentLoop
      async function* () {
        yield {
          type: 'text_delta',
          content: 'Step 2 complete: Implemented token verification.',
        };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    registry.register(new EchoTool());
    const executor = new ToolExecutor({ registry });
    const planner = new PlannerService();

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      planner,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream(
      'Refactor authentication service and add unit tests',
    )) {
      events.push(event);
    }

    // Verify event progression
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_created');
    expect(eventTypes).toContain('plan_ready');
    expect(eventTypes).toContain('plan_started');
    expect(eventTypes).toContain('step_started');
    expect(eventTypes).toContain('step_completed');
    expect(eventTypes).toContain('plan_completed');

    // Check active plan state
    const activePlan = agent.getActivePlan();
    expect(activePlan).toBeDefined();
    expect(activePlan?.status).toBe('completed');
    expect(activePlan?.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('handles plan-only requests by returning the plan and exiting without tool execution', async () => {
    const planJson = JSON.stringify({
      goal: 'Propose architecture for event bus',
      steps: [
        {
          id: 'step-1',
          title: 'Design event schema and bus interface',
          dependencies: [],
        },
        {
          id: 'step-2',
          title: 'Propose publisher and subscriber implementations',
          dependencies: ['step-1'],
        },
      ],
    });

    const mockProvider = new ScriptableLLMProvider([
      // Planner Turn: generates plan
      async function* () {
        yield { type: 'text_delta', content: planJson };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });
    const planner = new PlannerService();

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      planner,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream(
      'Create a plan for an event bus architecture, do not modify anything yet',
    )) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_created');
    expect(eventTypes).toContain('plan_ready');
    // Because it's plan-only, it should NOT start step execution
    expect(eventTypes).not.toContain('step_started');
    expect(eventTypes).toContain('agent_completed');

    const completedEvent = events.find((e) => e.type === 'agent_completed');
    expect(completedEvent).toBeDefined();
    if (completedEvent && completedEvent.type === 'agent_completed') {
      expect(completedEvent.output).toContain('Plan · Propose architecture for event bus');
    }
  });

  it('bypasses planning for simple inspection or query requests', async () => {
    const mockProvider = new ScriptableLLMProvider([
      async function* () {
        yield { type: 'text_delta', content: 'This repository contains Ixia CLI.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });
    const planner = new PlannerService();

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      planner,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream('What is this repository?')) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).not.toContain('plan_created');
    expect(eventTypes).not.toContain('plan_started');
    expect(eventTypes).toContain('agent_completed');
    expect(agent.getActivePlan()).toBeUndefined();
  });

  it('forces planning when forcePlan option is provided even for short prompts', async () => {
    const planJson = JSON.stringify({
      goal: 'Audit repository files',
      steps: [
        {
          id: 'step-1',
          title: 'List directory entries',
          dependencies: [],
        },
      ],
    });

    const mockProvider = new ScriptableLLMProvider([
      // Planner Turn
      async function* () {
        yield { type: 'text_delta', content: planJson };
        yield { type: 'completed' };
      },
      // Step 1
      async function* () {
        yield { type: 'text_delta', content: 'Files listed.' };
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });
    const planner = new PlannerService();

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      planner,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream('Audit files', { forcePlan: true })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_created');
    expect(eventTypes).toContain('step_started');
    expect(eventTypes).toContain('plan_completed');
  });

  it('cancels the plan when aborted during planned execution', async () => {
    const planJson = JSON.stringify({
      goal: 'Large multi-step migration',
      steps: [
        {
          id: 'step-1',
          title: 'Initial prep',
          dependencies: [],
        },
        {
          id: 'step-2',
          title: 'Execute migration',
          dependencies: ['step-1'],
        },
      ],
    });

    const abortController = new AbortController();

    const mockProvider = new ScriptableLLMProvider([
      // Planner Turn
      async function* () {
        yield { type: 'text_delta', content: planJson };
        yield { type: 'completed' };
      },
      // Step 1 Turn: abort during step 1
      async function* () {
        yield { type: 'text_delta', content: 'Starting prep...' };
        abortController.abort('User aborted execution');
        yield { type: 'completed' };
      },
    ]);

    const cm = new ConversationManager({ provider: mockProvider });
    const registry = new ToolRegistry();
    const executor = new ToolExecutor({ registry });
    const planner = new PlannerService();

    const agent = new AgentRuntime({
      conversationManager: cm,
      toolRegistry: registry,
      toolExecutor: executor,
      planner,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.runStream('Large multi-step migration', {
      forcePlan: true,
      signal: abortController.signal,
    })) {
      events.push(event);
    }

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('plan_cancelled');
    expect(agent.getActivePlan()?.status).toBe('cancelled');
  });
});
