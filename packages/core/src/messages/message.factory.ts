import { randomUUID } from 'node:crypto';
import type { Message, MessageRole } from './message.js';

export function createMessage(
  role: MessageRole,
  content: string,
  id?: string,
  createdAt?: Date,
): Message {
  return {
    id: id ?? randomUUID(),
    role,
    content,
    createdAt: createdAt ?? new Date(),
  };
}

export function createUserMessage(content: string, id?: string, createdAt?: Date): Message {
  return createMessage('user', content, id, createdAt);
}

export function createAssistantMessage(content: string, id?: string, createdAt?: Date): Message {
  return createMessage('assistant', content, id, createdAt);
}

export function createSystemMessage(content: string, id?: string, createdAt?: Date): Message {
  return createMessage('system', content, id, createdAt);
}
