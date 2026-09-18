import process from 'node:process';
import chalk from 'chalk';
import { EXIT_CODES, ConversationManager } from '@sora/core';
import { loadConfig, validateLLMConfig } from '@sora/config';
import { GroqProvider } from '@sora/llm';
import { ToolRegistry } from '@sora/tools';
import { registerFilesystemTools } from '@sora/filesystem';
import { registerShellTools } from '@sora/shell';
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
        if (
          event.type === 'assistant_text_delta' ||
          (event as { type: string }).type === 'text_delta'
        ) {
          process.stdout.write((event as { content: string }).content);
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

  // Discover actual registered tools for UI reference
  const toolRegistry = new ToolRegistry();
  registerFilesystemTools(toolRegistry);
  registerShellTools(toolRegistry);
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
    tools,
  });
}
