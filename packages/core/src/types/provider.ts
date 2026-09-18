import type { Message } from '../messages/message.js';
import type { ToolCall, ToolDefinition } from './tool.js';

export interface LLMRequestOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  tools?: readonly ToolDefinition[];
  responseFormat?: { type: 'json_object' | 'text' };
}

export type LLMEvent =
  | {
      type: 'text_delta';
      content: string;
    }
  | {
      type: 'tool_call';
      toolCall: ToolCall;
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
