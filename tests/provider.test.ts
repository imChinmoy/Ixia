import { describe, it, expect, vi } from 'vitest';
import {
  GroqProvider,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  InvalidModelError,
  type Message,
} from '@sora/llm';
import type Groq from 'groq-sdk';

describe('GroqProvider', () => {
  it('should initialize with model and custom client', () => {
    const mockGroq = {} as unknown as Groq;
    const provider = new GroqProvider({
      model: 'test-model',
      client: mockGroq,
    });

    expect(provider.name).toBe('groq');
    expect(provider.model).toBe('test-model');
  });

  it('should throw AuthenticationError if initialized without apiKey and client', () => {
    expect(() => {
      new GroqProvider({
        model: 'test-model',
      });
    }).toThrow(AuthenticationError);
  });

  it('should stream text chunks from Groq completion stream', async () => {
    async function* createMockStream(): AsyncIterable<{
      choices: Array<{ delta: { content?: string } }>;
    }> {
      yield { choices: [{ delta: { content: 'Chunk 1 ' } }] };
      yield { choices: [{ delta: { content: 'Chunk 2' } }] };
      yield { choices: [{ delta: {} }] }; // empty delta
    }

    const mockCreate = vi.fn().mockResolvedValue(createMockStream());
    const mockGroq = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as unknown as Groq;

    const provider = new GroqProvider({
      model: 'openai/gpt-oss-120b',
      client: mockGroq,
    });

    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const events = [];
    for await (const event of provider.stream(messages)) {
      events.push(event);
    }

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }),
      expect.any(Object),
    );

    expect(events).toEqual([
      { type: 'text_delta', content: 'Chunk 1 ' },
      { type: 'text_delta', content: 'Chunk 2' },
      { type: 'completed' },
    ]);
  });

  it('should map 401 status to AuthenticationError', async () => {
    const mockCreate = vi.fn().mockRejectedValue({
      status: 401,
      message: 'Invalid API Key',
    });
    const mockGroq = {
      chat: { completions: { create: mockCreate } },
    } as unknown as Groq;

    const provider = new GroqProvider({
      model: 'test-model',
      client: mockGroq,
    });

    const events = [];
    for await (const event of provider.stream([{ role: 'user', content: 'hi' }])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error).toBeInstanceOf(AuthenticationError);
    }
  });

  it('should map 429 status to RateLimitError', async () => {
    const mockCreate = vi.fn().mockRejectedValue({
      status: 429,
      message: 'Rate limit exceeded',
    });
    const mockGroq = {
      chat: { completions: { create: mockCreate } },
    } as unknown as Groq;

    const provider = new GroqProvider({
      model: 'test-model',
      client: mockGroq,
    });

    const events = [];
    for await (const event of provider.stream([{ role: 'user', content: 'hi' }])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error).toBeInstanceOf(RateLimitError);
    }
  });

  it('should map 404 / invalid model status to InvalidModelError', async () => {
    const mockCreate = vi.fn().mockRejectedValue({
      status: 404,
      message: 'The model `invalid-model` does not exist',
    });
    const mockGroq = {
      chat: { completions: { create: mockCreate } },
    } as unknown as Groq;

    const provider = new GroqProvider({
      model: 'invalid-model',
      client: mockGroq,
    });

    const events = [];
    for await (const event of provider.stream([{ role: 'user', content: 'hi' }])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error).toBeInstanceOf(InvalidModelError);
    }
  });

  it('should map network failure to NetworkError', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
    const mockGroq = {
      chat: { completions: { create: mockCreate } },
    } as unknown as Groq;

    const provider = new GroqProvider({
      model: 'test-model',
      client: mockGroq,
    });

    const events = [];
    for await (const event of provider.stream([{ role: 'user', content: 'hi' }])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    if (events[0]?.type === 'error') {
      expect(events[0].error).toBeInstanceOf(NetworkError);
    }
  });
});
