export type SoraVersion = string;

export interface SoraRuntime {
  version: SoraVersion;
  nodeVersion: string;
  cwd: string;
}

export type UIState = 'idle' | 'input' | 'processing' | 'exiting';

export type MessageType = 'user' | 'system' | 'assistant' | 'info' | 'error';

export interface MessageItem {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
}

export interface CommandContext {
  cwd: string;
  version: SoraVersion;
  interactive: boolean;
  prompt?: string;
}

export * from './provider.js';
