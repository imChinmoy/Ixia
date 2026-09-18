import type { ToolCall } from '../types/tool.js';

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolCallId?: string;
  readonly toolName?: string;
}

