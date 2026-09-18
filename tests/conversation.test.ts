import { describe, it, expect } from 'vitest';
import {
  ConversationManager,
  ConversationBusyError,
  createUserMessage,
  createAssistantMessage,
  type LLMProvider,
  type LLMEvent,
  type Message,
  type ConversationEvent,
} from '@ixia/core';

class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  public lastReceivedMessages: Message[] = [];
  public delayMs: number = 0;
  public failWithError?: Error;

  constructor(options?: { delayMs?: number; failWithError?: Error }) {
    if (options?.delayMs) this.delayMs = options.delayMs;
    if (options?.failWithError) this.failWithError = options.failWithError;
  }

  async *stream(messages: Message[]): AsyncIterable<LLMEvent> {
    this.lastReceivedMessages = [...messages];

    if (this.failWithError) {
      yield { type: 'error', error: this.failWithError };
      return;
    }

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    yield { type: 'text_delta', content: 'Hello ' };
    yield { type: 'text_delta', content: 'there!' };
    yield { type: 'completed' };
  }
}

describe('ConversationManager (Phase 3)', () => {
  it('should initialize with empty messages, default system prompt, and idle status', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    expect(manager.getMessages()).toHaveLength(0);
    expect(manager.getStatus()).toBe('idle');
    expect(manager.getState()).toEqual({
      messages: [],
      status: 'idle',
    });
    expect(manager.getSystemPrompt()).toContain('You are Ixia');
    expect(manager.getProvider()).toBe(mockProvider);
  });

  it('should initialize with custom system prompt and initial messages', () => {
    const mockProvider = new MockLLMProvider();
    const initial = [
      createUserMessage('Previous question'),
      createAssistantMessage('Previous answer'),
    ];
    const customPrompt = 'Custom system instructions';
    const manager = new ConversationManager({
      provider: mockProvider,
      systemPrompt: customPrompt,
      initialMessages: initial,
    });

    expect(manager.getMessages()).toHaveLength(2);
    expect(manager.getMessages()[0]?.content).toBe('Previous question');
    expect(manager.getSystemPrompt()).toBe(customPrompt);
  });

  it('should add user and assistant messages explicitly with correct roles and timestamps', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    const userMsg = manager.addUserMessage('User question');
    const assistantMsg = manager.addAssistantMessage('Assistant answer');

    const history = manager.getMessages();
    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe(userMsg.id);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toBe('User question');
    expect(history[0]?.createdAt).toBeInstanceOf(Date);

    expect(history[1]?.id).toBe(assistantMsg.id);
    expect(history[1]?.role).toBe('assistant');
    expect(history[1]?.content).toBe('Assistant answer');
  });

  it('should return defensive copies from getMessages to prevent state mutation', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    manager.addUserMessage('Message 1');
    const messages = manager.getMessages() as Message[];
    expect(messages).toHaveLength(1);

    // Mutate the returned array
    messages.push(createUserMessage('Tampered message'));

    // Internal state remains unmodified
    expect(manager.getMessages()).toHaveLength(1);
  });

  it('should allow changing system prompt via setSystemPrompt', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    manager.setSystemPrompt('Updated prompt');
    expect(manager.getSystemPrompt()).toBe('Updated prompt');
  });

  it('should emit full conversation lifecycle events and accumulate assistant message', async () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    const events: ConversationEvent[] = [];
    for await (const event of manager.send('Tell me a joke')) {
      events.push(event);
    }

    // Check event sequence:
    // 1. user_message
    // 2. generation_started
    // 3. assistant_text_delta ('Hello ')
    // 4. assistant_text_delta ('there!')
    // 5. assistant_message_completed
    // 6. generation_completed
    expect(events).toHaveLength(6);

    expect(events[0]?.type).toBe('user_message');
    if (events[0]?.type === 'user_message') {
      expect(events[0].message.role).toBe('user');
      expect(events[0].message.content).toBe('Tell me a joke');
    }

    expect(events[1]?.type).toBe('generation_started');

    expect(events[2]?.type).toBe('assistant_text_delta');
    if (events[2]?.type === 'assistant_text_delta') {
      expect(events[2].content).toBe('Hello ');
    }

    expect(events[3]?.type).toBe('assistant_text_delta');
    if (events[3]?.type === 'assistant_text_delta') {
      expect(events[3].content).toBe('there!');
    }

    expect(events[4]?.type).toBe('assistant_message_completed');
    if (events[4]?.type === 'assistant_message_completed') {
      expect(events[4].message.role).toBe('assistant');
      expect(events[4].message.content).toBe('Hello there!');
    }

    expect(events[5]?.type).toBe('generation_completed');

    // Verify manager messages history: exactly 2 messages (1 user, 1 assistant)
    const history = manager.getMessages();
    expect(history).toHaveLength(2);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toBe('Tell me a joke');
    expect(history[1]?.role).toBe('assistant');
    expect(history[1]?.content).toBe('Hello there!');

    // Status is restored to idle
    expect(manager.getStatus()).toBe('idle');

    // Provider received system prompt prepended + user message
    expect(mockProvider.lastReceivedMessages).toHaveLength(2);
    expect(mockProvider.lastReceivedMessages[0]?.role).toBe('system');
    expect(mockProvider.lastReceivedMessages[1]?.role).toBe('user');
    expect(mockProvider.lastReceivedMessages[1]?.content).toBe('Tell me a joke');
  });

  it('should preserve multi-turn conversation history across multiple queries', async () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    // Turn 1
    for await (const _ of manager.sendMessage('First turn')) {
      // drain
    }

    // Turn 2
    for await (const _ of manager.sendMessage('Second turn')) {
      // drain
    }

    const history = manager.getMessages();
    expect(history).toHaveLength(4);
    expect(history[0]?.content).toBe('First turn');
    expect(history[1]?.content).toBe('Hello there!');
    expect(history[2]?.content).toBe('Second turn');
    expect(history[3]?.content).toBe('Hello there!');

    // Provider in turn 2 received system prompt + all 3 previous items + current query
    expect(mockProvider.lastReceivedMessages).toHaveLength(4);
    expect(mockProvider.lastReceivedMessages[0]?.role).toBe('system');
    expect(mockProvider.lastReceivedMessages[1]?.content).toBe('First turn');
    expect(mockProvider.lastReceivedMessages[2]?.content).toBe('Hello there!');
    expect(mockProvider.lastReceivedMessages[3]?.content).toBe('Second turn');
  });

  it('should reject concurrent requests while generation is in progress', async () => {
    // Provider with 50ms simulated delay
    const mockProvider = new MockLLMProvider({ delayMs: 50 });
    const manager = new ConversationManager({ provider: mockProvider });

    // Start first generation
    const stream1 = manager.send('First request');
    const iter1 = stream1[Symbol.asyncIterator]();

    // Pull first event to enter 'generating' status
    const firstEvent = await iter1.next();
    expect(firstEvent.value?.type).toBe('user_message');
    expect(manager.getStatus()).toBe('generating');

    // Attempt second generation while first is still generating
    await expect(async () => {
      for await (const _ of manager.send('Second concurrent request')) {
        // should not reach here
      }
    }).rejects.toThrow(ConversationBusyError);

    await expect(async () => {
      for await (const _ of manager.send('Second concurrent request')) {
        // should not reach here
      }
    }).rejects.toThrow('A request is already in progress. Please wait until generation finishes.');

    // Drain first generation to completion
    let done = false;
    while (!done) {
      const res = await iter1.next();
      done = !!res.done;
    }

    expect(manager.getStatus()).toBe('idle');
  });

  it('should handle provider errors cleanly without corrupting message history', async () => {
    const errorProvider = new MockLLMProvider({
      failWithError: new Error('API connection timeout'),
    });
    const manager = new ConversationManager({ provider: errorProvider });

    const events: ConversationEvent[] = [];
    for await (const event of manager.send('Will fail')) {
      events.push(event);
    }

    // Should emit: user_message, generation_started, error
    expect(events.some((e) => e.type === 'error')).toBe(true);
    const errorEvent = events.find((e) => e.type === 'error');
    if (errorEvent?.type === 'error') {
      expect(errorEvent.error.message).toBe('API connection timeout');
    }

    expect(manager.getStatus()).toBe('error');

    // Conversation history should contain only the user message, NO partial/empty assistant message
    const history = manager.getMessages();
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toBe('Will fail');
  });

  it('should handle provider throwing exception inside stream generator', async () => {
    const throwingProvider: LLMProvider = {
      name: 'throwing',
      model: 'throw-model',
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new Error('Fatal stream crash');
      },
    };

    const manager = new ConversationManager({ provider: throwingProvider });

    const events: ConversationEvent[] = [];
    for await (const event of manager.send('Crashing query')) {
      events.push(event);
    }

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.error.message).toBe('Fatal stream crash');
    }
    expect(manager.getStatus()).toBe('error');
    expect(manager.getMessages()).toHaveLength(1); // no corrupted assistant message
  });

  it('should ignore empty or whitespace-only input', async () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    const events: ConversationEvent[] = [];
    for await (const event of manager.send('   ')) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
    expect(manager.getMessages()).toHaveLength(0);
    expect(manager.getStatus()).toBe('idle');
  });

  it('should clear conversation history and reset status to idle', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    manager.addUserMessage('msg');
    expect(manager.getMessages()).toHaveLength(1);

    manager.clear();
    expect(manager.getMessages()).toHaveLength(0);
    expect(manager.getStatus()).toBe('idle');
  });

  it('should forward tool_call events from provider stream', async () => {
    class ToolCallingMockProvider implements LLMProvider {
      readonly name = 'mock';
      readonly model = 'mock-model';
      async *stream(): AsyncIterable<LLMEvent> {
        yield { type: 'text_delta', content: 'I will call echo.' };
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call_123',
            name: 'echo',
            arguments: { message: 'hello' },
          },
        };
        yield { type: 'completed' };
      }
    }

    const manager = new ConversationManager({ provider: new ToolCallingMockProvider() });
    const events: ConversationEvent[] = [];

    for await (const event of manager.send('Run echo')) {
      events.push(event);
    }

    const toolCallEvents = events.filter((e) => e.type === 'tool_call');
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0]).toEqual({
      type: 'tool_call',
      toolCall: {
        id: 'call_123',
        name: 'echo',
        arguments: { message: 'hello' },
      },
    });
    expect(manager.getStatus()).toBe('idle');
  });
});
