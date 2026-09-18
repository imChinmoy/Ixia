import { DEFAULT_VERSION } from '@sora/core';
import { formatPath } from '@sora/shared';

export interface SlashContext {
  cwd?: string;
  model?: string;
  provider?: string;
  version?: string;
}

export type SlashResult =
  | { type: 'exit' }
  | { type: 'clear'; message: string }
  | { type: 'help'; message: string }
  | { type: 'status'; message: string }
  | { type: 'model'; message: string }
  | { type: 'unknown'; command: string; message: string };

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

export function handleSlashCommand(input: string, context: SlashContext = {}): SlashResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [command] = trimmed.split(/\s+/);
  const cmd = command?.toLowerCase();

  switch (cmd) {
    case '/help':
      return {
        type: 'help',
        message: [
          'Sora Commands',
          '',
          '  /help       Show available commands',
          '  /clear      Clear conversation',
          '  /status     Show current session information',
          '  /model      Show active model',
          '  /exit       Exit Sora',
          '  /quit       Exit Sora',
        ].join('\n'),
      };

    case '/clear':
      return {
        type: 'clear',
        message: 'Conversation cleared.',
      };

    case '/status': {
      const version = context.version || DEFAULT_VERSION;
      const provider = context.provider || 'Groq';
      const model = context.model || 'openai/gpt-oss-120b';
      const cwd = formatPath(context.cwd || process.cwd());

      return {
        type: 'status',
        message: [
          'Sora Status',
          '',
          `  Version     ${version}`,
          `  Provider    ${provider}`,
          `  Model       ${model}`,
          `  Directory   ${cwd}`,
          '  Mode        Interactive',
        ].join('\n'),
      };
    }

    case '/model': {
      const model = context.model || 'openai/gpt-oss-120b';
      return {
        type: 'model',
        message: [`Current model:`, '', `  ${model}`].join('\n'),
      };
    }

    case '/exit':
    case '/quit':
      return {
        type: 'exit',
      };

    default:
      return {
        type: 'unknown',
        command: cmd || trimmed,
        message: `Unknown command: ${cmd}. Type /help for available commands.`,
      };
  }
}
