import type { Message } from './types/message.js';
import type { LLMEvent } from './types/events.js';

export interface LLMRequestOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent>;
}
