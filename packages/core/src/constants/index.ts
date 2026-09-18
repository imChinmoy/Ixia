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
