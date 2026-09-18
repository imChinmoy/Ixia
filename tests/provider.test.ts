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

  it('should translate Sora tool definitions into Groq format and emit tool_call events', async () => {
    async function* createMockToolStream(): AsyncIterable<{
      choices: Array<{
        delta: {
          content?: string;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    }> {
      yield { choices: [{ delta: { content: 'Calling echo...' } }] };
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_abc123',
                  function: { name: 'echo', arguments: '{"mess' },
                },
              ],
            },
          },
        ],
      };
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: 'age": "hello world"}' },
                },
              ],
            },
          },
        ],
      };
    }

    const mockCreate = vi.fn().mockResolvedValue(createMockToolStream());
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

    const toolDef = {
      name: 'echo',
      description: 'Echo message',
      inputSchema: {
        type: 'object' as const,
        properties: {
          message: { type: 'string' as const },
        },
        required: ['message'],
      },
    };

    const events = [];
    for await (const event of provider.stream([{ role: 'user', content: 'Say hi' }], {
      tools: [toolDef],
    })) {
      events.push(event);
    }

    // Verify request payload sent to Groq SDK
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-oss-120b',
        tools: [
          {
            type: 'function',
            function: {
              name: 'echo',
              description: 'Echo message',
              parameters: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
                required: ['message'],
                additionalProperties: undefined,
              },
            },
          },
        ],
      }),
      expect.any(Object),
    );

    // Verify emitted Sora LLM events
    expect(events).toEqual([
      { type: 'text_delta', content: 'Calling echo...' },
      {
        type: 'tool_call',
        toolCall: {
          id: 'call_abc123',
          name: 'echo',
          arguments: { message: 'hello world' },
        },
      },
      { type: 'completed' },
    ]);
  });
});
