import process from 'node:process';
import chalk from 'chalk';
import { EXIT_CODES, ConversationManager } from '@sora/core';
import { loadConfig, validateLLMConfig } from '@sora/config';
import { GroqProvider } from '@sora/llm';
import { ToolRegistry, ToolExecutor } from '@sora/tools';
import { registerFilesystemTools } from '@sora/filesystem';
import { registerShellTools } from '@sora/shell';
import { AgentRuntime } from '@sora/agent';
import { renderInteractiveUI } from '../ui/index.js';
import { logger } from '@sora/logger';

export interface StartCommandOptions {
  prompt?: string;
}

export async function startCommand(options: StartCommandOptions = {}): Promise<void> {
  const config = loadConfig();
  validateLLMConfig(config.llm);

  const provider = new GroqProvider({
    apiKey: config.llm.apiKey,
    model: config.llm.model,
  });

  const conversationManager = new ConversationManager({ provider });

  // Initialize tool infrastructure
  const toolRegistry = new ToolRegistry();
  registerFilesystemTools(toolRegistry);
  registerShellTools(toolRegistry);

  const toolExecutor = new ToolExecutor({
    registry: toolRegistry,
    defaultCwd: process.cwd(),
  });

  const agentRuntime = new AgentRuntime({
    conversationManager,
    toolRegistry,
    toolExecutor,
    config: {
      cwd: process.cwd(),
      maxIterations: 10,
      maxToolCalls: 25,
    },
  });

  const prompt = options.prompt?.trim();

  if (prompt) {
    // One-shot mode
    logger.debug('Running in one-shot mode with prompt:', prompt);
    process.stdout.write(`${chalk.bold.cyan('Sora:')}\n\n`);

    const abortController = new AbortController();
    const onSigint = () => {
      abortController.abort('User interrupted (Ctrl+C)');
      process.stderr.write(`\n${chalk.yellow('Execution interrupted by user.')}\n`);
      process.exit(EXIT_CODES.SIGINT);
    };
    process.on('SIGINT', onSigint);

    try {
      for await (const event of agentRuntime.runStream(prompt, {
        signal: abortController.signal,
      })) {
        if (event.type === 'tool_call_started') {
          const args =
            Object.keys(event.toolCall.arguments).length > 0
              ? chalk.dim(JSON.stringify(event.toolCall.arguments))
              : '';
          process.stdout.write(
            `${chalk.cyan('→')} ${chalk.bold(event.toolCall.name)} ${args}\n`,
          );
        } else if (event.type === 'tool_call_completed') {
          process.stdout.write(
            `${chalk.green('✓')} ${chalk.dim(event.toolCall.name)}\n\n`,
          );
        } else if (event.type === 'tool_call_failed') {
          process.stdout.write(
            `${chalk.red('✗')} ${chalk.red(event.toolCall.name)}: ${event.error.message}\n\n`,
          );
        } else if (event.type === 'llm_text_delta') {
          process.stdout.write(event.content);
        } else if (event.type === 'agent_error') {
          process.stderr.write(`\n${chalk.red('Error:')} ${event.error.message}\n`);
          process.exit(EXIT_CODES.ERROR);
        } else if (event.type === 'agent_cancelled') {
          process.stderr.write(`\n${chalk.yellow('Cancelled.')}\n`);
          process.exit(EXIT_CODES.SIGINT);
        }
      }
      process.stdout.write('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`\n${chalk.red('Error:')} ${message}\n`);
      process.exit(EXIT_CODES.ERROR);
    } finally {
      process.off('SIGINT', onSigint);
    }
    return;
  }

  const tools = toolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
  }));

  // Interactive mode
  logger.debug('Starting interactive terminal UI session');
  await renderInteractiveUI({
    cwd: process.cwd(),
    provider: 'Groq',
    model: config.llm.model,
    version: config.version,
    conversationManager,
    agentRuntime,
    tools,
  });
}

