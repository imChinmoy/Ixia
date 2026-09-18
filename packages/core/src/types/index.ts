export type SoraVersion = string;

export interface SoraRuntime {
  version: SoraVersion;
  nodeVersion: string;
  cwd: string;
}

export type UIState = 'idle' | 'input' | 'processing' | 'exiting';

export type MessageType = 'user' | 'system' | 'assistant' | 'info' | 'error' | 'tool';

export interface MessageItem {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
  toolStatus?: 'running' | 'success' | 'failed';
}

export interface CommandContext {
  cwd: string;
  version: SoraVersion;
  interactive: boolean;
  prompt?: string;
}

export * from './provider.js';
export * from './tool.js';
