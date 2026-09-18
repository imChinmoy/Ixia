export const APP_NAME = 'Sora';
export const APP_DESCRIPTION = 'AI coding agent';
export const DEFAULT_VERSION = '0.2.0';
export const PROMPT_SYMBOL = '❯';

export const EXIT_COMMANDS = ['exit', 'quit'] as const;
export type ExitCommand = (typeof EXIT_COMMANDS)[number];

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  SIGINT: 130,
} as const;

export const DEFAULT_SYSTEM_PROMPT = `You are Sora, an AI coding assistant running in the user's terminal.

Be concise, technically accurate, and helpful.

At this stage you cannot directly access or modify the user's files.`;
