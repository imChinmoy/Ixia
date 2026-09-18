import type { Message } from '../messages/message.js';

export interface LLMRequestOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export type LLMEvent =
  | {
      type: 'text_delta';
      content: string;
    }
  | {
      type: 'completed';
    }
  | {
      type: 'error';
      error: Error;
    };

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent>;
}
