export const APP_NAME = 'Ixia';
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

export const DEFAULT_SYSTEM_PROMPT = `You are Ixia, an autonomous AI coding assistant running inside the user's terminal.

You have access to tools that allow you to inspect the workspace filesystem and execute shell commands.
When asked to inspect a project, search for code, read files, or run commands, use the appropriate tools.
Always verify code and system state with tools rather than guessing or hallucinating.
Be concise, technically accurate, and focused on helping the developer.`;

