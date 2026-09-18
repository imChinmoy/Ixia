import Groq from 'groq-sdk';
import { logger } from '@sora/logger';
import type { Message } from '../types/message.js';
import type { LLMEvent } from '../types/events.js';
import type { LLMProvider, LLMRequestOptions } from '../provider.js';
import {
  AuthenticationError,
  RateLimitError,
  NetworkError,
  InvalidModelError,
  LLMError,
} from '../errors.js';
import { createGroqClient } from './groq.client.js';
import { toGroqTools, toSoraToolCall, toGroqMessages } from './groq.adapter.js';

export interface GroqProviderOptions {
  apiKey?: string;
  model: string;
  client?: Groq;
}

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  readonly model: string;
  private client: Groq;

  constructor(options: GroqProviderOptions) {
    this.model = options.model;
    if (options.client) {
      this.client = options.client;
    } else {
      if (!options.apiKey) {
        throw new AuthenticationError('GROQ_PROVIDER_KEY is required to initialize GroqProvider.');
      }
      this.client = createGroqClient({ apiKey: options.apiKey });
    }
  }

  async *stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    logger.debug('Provider: Groq');
    logger.debug(`Model: ${this.model}`);
    logger.debug('Request started');

    const groqMessages = toGroqMessages(messages);


    const groqTools = toGroqTools(options?.tools);

    let stream: AsyncIterable<Groq.Chat.ChatCompletionChunk>;

    try {
      stream = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: groqMessages,
          stream: true,
          temperature: options?.temperature,
          max_completion_tokens: options?.maxTokens,
          tools: groqTools,
          response_format: options?.responseFormat ? { type: options.responseFormat.type } : undefined,
        },
        {
          signal: options?.signal,
        },
      );
      logger.debug('Streaming started');
    } catch (error) {
      const mappedError = this.mapError(error);
      yield { type: 'error', error: mappedError };
      return;
    }

    try {
      const toolCallsByIndex = new Map<
        number,
        { id: string; name: string; argumentsBuffer: string }
      >();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          yield {
            type: 'text_delta',
            content: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let existing = toolCallsByIndex.get(idx);
            if (!existing) {
              existing = {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                argumentsBuffer: '',
              };
              toolCallsByIndex.set(idx, existing);
            }
            if (tc.id) {
              existing.id = tc.id;
            }
            if (tc.function?.name) {
              existing.name = tc.function.name;
            }
            if (tc.function?.arguments) {
              existing.argumentsBuffer += tc.function.arguments;
            }
          }
        }
      }

      for (const accumulated of toolCallsByIndex.values()) {
        const toolCall = toSoraToolCall(accumulated);
        logger.debug(`Tool call received: ${toolCall.name} (${toolCall.id})`);
        yield {
          type: 'tool_call',
          toolCall,
        };
      }

      logger.debug('Request completed');
      yield { type: 'completed' };
    } catch (error) {
      const mappedError = this.mapError(error);
      yield { type: 'error', error: mappedError };
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof LLMError) {
      return error;
    }

    // Check Groq SDK APIError status codes
    const err = error as {
      status?: number;
      message?: string;
      code?: string;
      type?: string;
    };

    const status = err.status;
    const message = err.message ?? String(error);

    if (status === 401 || err.code === 'invalid_api_key') {
      return new AuthenticationError();
    }

    if (status === 429 || err.code === 'rate_limit_exceeded') {
      return new RateLimitError();
    }

    if (status === 404 || (status === 400 && message.toLowerCase().includes('model'))) {
      return new InvalidModelError(
        this.model,
        `Invalid model "${this.model}". Please check your model configuration.`,
      );
    }

    // Network / connection / timeout errors
    if (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('network')
    ) {
      return new NetworkError();
    }

    return new LLMError(message);
  }
}
