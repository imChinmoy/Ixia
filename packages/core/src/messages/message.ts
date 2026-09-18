export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
}
