import process from 'node:process';
import chalk from 'chalk';
import { createHeaderBox } from '@sora/shared';
import { PROMPT_SYMBOL } from '@sora/core';
import { renderInteractiveUI } from '../ui/index.js';
import { logger } from '@sora/logger';

export interface StartCommandOptions {
  prompt?: string;
}

export async function startCommand(options: StartCommandOptions = {}): Promise<void> {
  const prompt = options.prompt?.trim();

  if (prompt) {
    // One-shot mode
    logger.debug('Running in one-shot mode with prompt:', prompt);
    const compactHeader = createHeaderBox(true);
    console.log(compactHeader);
    console.log();
    console.log(`${chalk.cyan(PROMPT_SYMBOL)} ${prompt}`);
    console.log();
    console.log('Sora CLI is running in Phase 1.');
    console.log();
    console.log('LLM integration will be added in Phase 2.');
    return;
  }

  // Interactive mode
  logger.debug('Starting interactive terminal UI session');
  await renderInteractiveUI({
    cwd: process.cwd(),
  });
}
