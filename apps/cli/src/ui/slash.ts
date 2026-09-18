import process from 'node:process';
import { DEFAULT_VERSION } from '@ixia/core';
import { formatPath } from '@ixia/shared';

import type { Plan } from '@ixia/planner';

export interface SlashContext {
  cwd?: string;
  model?: string;
  provider?: string;
  version?: string;
  tools?: Array<{ name: string; description: string }>;
  messagesCount?: number;
  activePlan?: Plan;
}

export type SlashResult =
  | { type: 'exit' }
  | { type: 'clear'; message: string }
  | { type: 'help'; message: string }
  | { type: 'tools'; message: string }
  | { type: 'cwd'; message: string }
  | { type: 'config'; message: string }
  | { type: 'status'; message: string }
  | { type: 'model'; message: string }
  | { type: 'plan'; message: string }
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
          'Ixia Commands',
          '',
          '  /help       Show available commands',
          '  /plan       Show active plan',
          '  /tools      List available tools',
          '  /cwd        Show current directory',
          '  /clear      Clear conversation',
          '  /new        Start a new session',
          '  /model      Show active model',
          '  /config     Show configuration',
          '  /status     Show current session information',
          '  /exit       Exit Ixia',
          '  /quit       Exit Ixia',
        ].join('\n'),
      };

    case '/plan': {
      if (!context.activePlan) {
        return {
          type: 'plan',
          message: 'No active plan. Ixia creates plans automatically for complex multi-step tasks.',
        };
      }

      const plan = context.activePlan;
      const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
      const lines = [
        `Plan · ${plan.goal} (${completedCount}/${plan.steps.length} completed)`,
        '',
      ];

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i]!;
        let marker = '○';
        if (step.id === plan.currentStepId || step.status === 'in_progress') marker = '→';
        else if (step.status === 'completed') marker = '✓';
        else if (step.status === 'failed') marker = '×';
        else if (step.status === 'blocked') marker = '!';
        else if (step.status === 'skipped') marker = '⊘';
        lines.push(`  ${i + 1}. ${marker} ${step.title}`);
      }

      return {
        type: 'plan',
        message: lines.join('\n'),
      };
    }

    case '/tools': {
      const tools =
        context.tools && context.tools.length > 0
          ? context.tools
          : [
              { name: 'list_directory', description: 'List directory contents' },
              { name: 'read_file', description: 'Read text files' },
              { name: 'search_files', description: 'Search project files' },
              { name: 'file_info', description: 'Inspect file metadata' },
              { name: 'execute_command', description: 'Execute terminal commands' },
            ];

      const lines = [
        'Available Tools',
        '',
        ...tools.flatMap((t) => [`  ◆ ${t.name}`, `    ${t.description}`, '']),
      ];

      return {
        type: 'tools',
        message: lines.join('\n').trimEnd(),
      };
    }

    case '/cwd': {
      const cwd = formatPath(context.cwd || process.cwd());
      return {
        type: 'cwd',
        message: `Current working directory: ${cwd}`,
      };
    }

    case '/clear':
    case '/new':
      return {
        type: 'clear',
        message: 'Conversation cleared.',
      };

    case '/status': {
      const version = context.version || DEFAULT_VERSION;
      const provider = context.provider || 'Groq';
      const model = context.model || 'openai/gpt-oss-120b';
      const cwd = formatPath(context.cwd || process.cwd());
      const toolsCount = context.tools?.length ?? 5;
      const msgCount = context.messagesCount ?? 0;

      return {
        type: 'status',
        message: [
          'Ixia Status',
          '',
          `  Version     ${version}`,
          `  Provider    ${provider}`,
          `  Model       ${model}`,
          `  Directory   ${cwd}`,
          `  Tools       ${toolsCount} available`,
          `  Messages    ${msgCount}`,
          '  Mode        Interactive',
        ].join('\n'),
      };
    }

    case '/config': {
      const version = context.version || DEFAULT_VERSION;
      const provider = context.provider || 'Groq';
      const model = context.model || 'openai/gpt-oss-120b';
      const cwd = formatPath(context.cwd || process.cwd());

      return {
        type: 'config',
        message: [
          'Ixia Configuration',
          '',
          `  Provider     ${provider}`,
          `  Model        ${model}`,
          `  Directory    ${cwd}`,
          `  Version      ${version}`,
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
