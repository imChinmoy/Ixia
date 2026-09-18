import { describe, it, expect } from 'vitest';
import { ConversationManager, type LLMProvider, type LLMEvent, type Message } from '@sora/llm';

class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  public lastReceivedMessages: Message[] = [];

  async *stream(messages: Message[]): AsyncIterable<LLMEvent> {
    this.lastReceivedMessages = [...messages];
    yield { type: 'text_delta', content: 'Hello ' };
    yield { type: 'text_delta', content: 'there!' };
    yield { type: 'completed' };
  }
}

describe('ConversationManager', () => {
  it('should initialize with empty messages and default system prompt', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    expect(manager.getMessages()).toHaveLength(0);
    expect(manager.getSystemPrompt()).toContain('You are Sora');
  });

  it('should add user and assistant messages explicitly', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    manager.addUserMessage('User question');
    manager.addAssistantMessage('Assistant answer');

    const history = manager.getMessages();
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'User question' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Assistant answer' });
  });

  it('should stream response, accumulate chunks, and record assistant message in history', async () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    const chunks: string[] = [];
    for await (const event of manager.sendMessage('Tell me a joke')) {
      if (event.type === 'text_delta') {
        chunks.push(event.content);
      }
    }

    expect(chunks.join('')).toBe('Hello there!');

    // Verify conversation history
    const history = manager.getMessages();
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'Tell me a joke' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hello there!' });

    // Verify payload sent to provider had system prompt prepended
    expect(mockProvider.lastReceivedMessages).toHaveLength(2);
    expect(mockProvider.lastReceivedMessages[0]?.role).toBe('system');
    expect(mockProvider.lastReceivedMessages[1]?.role).toBe('user');
  });

  it('should preserve multi-turn conversation history across queries', async () => {
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
    expect(history[0]).toEqual({ role: 'user', content: 'First turn' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hello there!' });
    expect(history[2]).toEqual({ role: 'user', content: 'Second turn' });
    expect(history[3]).toEqual({ role: 'assistant', content: 'Hello there!' });

    // In turn 2, the provider should have received system prompt + all 3 previous items + current query
    expect(mockProvider.lastReceivedMessages).toHaveLength(4);
    expect(mockProvider.lastReceivedMessages[0]?.role).toBe('system');
    expect(mockProvider.lastReceivedMessages[1]?.content).toBe('First turn');
    expect(mockProvider.lastReceivedMessages[2]?.content).toBe('Hello there!');
    expect(mockProvider.lastReceivedMessages[3]?.content).toBe('Second turn');
  });

  it('should clear conversation history', () => {
    const mockProvider = new MockLLMProvider();
    const manager = new ConversationManager({ provider: mockProvider });

    manager.addUserMessage('msg');
    expect(manager.getMessages()).toHaveLength(1);

    manager.clear();
    expect(manager.getMessages()).toHaveLength(0);
  });
});
