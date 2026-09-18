import process from 'node:process';
import chalk from 'chalk';
import { EXIT_CODES } from '@sora/core';
import { loadConfig, validateLLMConfig } from '@sora/config';
import { GroqProvider, ConversationManager } from '@sora/llm';
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
  const prompt = options.prompt?.trim();

  if (prompt) {
    // One-shot mode
    logger.debug('Running in one-shot mode with prompt:', prompt);
    process.stdout.write(`${chalk.bold.cyan('Sora:')}\n\n`);

    try {
      for await (const event of conversationManager.sendMessage(prompt)) {
        if (event.type === 'text_delta') {
          process.stdout.write(event.content);
        } else if (event.type === 'error') {
          process.stderr.write(`\n${chalk.red('Error:')} ${event.error.message}\n`);
          process.exit(EXIT_CODES.ERROR);
        }
      }
      process.stdout.write('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`\n${chalk.red('Error:')} ${message}\n`);
      process.exit(EXIT_CODES.ERROR);
    }
    return;
  }

  // Interactive mode
  logger.debug('Starting interactive terminal UI session');
  await renderInteractiveUI({
    cwd: process.cwd(),
    model: config.llm.model,
    conversationManager,
  });
}
