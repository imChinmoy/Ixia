import { randomUUID } from 'node:crypto';
import type { Message, MessageRole } from './message.js';
import type { ToolCall } from '../types/tool.js';

export interface CreateMessageOptions {
  id?: string;
  createdAt?: Date;
  toolCalls?: readonly ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export function createMessage(
  role: MessageRole,
  content: string,
  id?: string,
  createdAt?: Date,
  options?: CreateMessageOptions,
): Message {
  return {
    id: options?.id ?? id ?? randomUUID(),
    role,
    content,
    createdAt: options?.createdAt ?? createdAt ?? new Date(),
    ...(options?.toolCalls !== undefined ? { toolCalls: options.toolCalls } : {}),
    ...(options?.toolCallId !== undefined ? { toolCallId: options.toolCallId } : {}),
    ...(options?.toolName !== undefined ? { toolName: options.toolName } : {}),
  };
}

export function createUserMessage(content: string, id?: string, createdAt?: Date): Message {
  return createMessage('user', content, id, createdAt);
}

export function createAssistantMessage(
  content: string,
  id?: string,
  createdAt?: Date,
  toolCalls?: readonly ToolCall[],
): Message {
  return createMessage('assistant', content, id, createdAt, { toolCalls });
}

export function createAssistantToolCallMessage(
  toolCalls: readonly ToolCall[],
  content = '',
  id?: string,
  createdAt?: Date,
): Message {
  return createMessage('assistant', content, id, createdAt, { toolCalls });
}

export function createToolResultMessage(
  toolCallId: string,
  toolName: string,
  content: string,
  id?: string,
  createdAt?: Date,
): Message {
  return createMessage('tool', content, id, createdAt, { toolCallId, toolName });
}

export function createSystemMessage(content: string, id?: string, createdAt?: Date): Message {
  return createMessage('system', content, id, createdAt);
}

