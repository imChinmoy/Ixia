#!/usr/bin/env node

import { Command } from 'commander';
import { APP_DESCRIPTION, DEFAULT_VERSION, EXIT_CODES, isSoraError } from '@sora/core';
import { startCommand } from './commands/start.command.js';
import { logger } from '@sora/logger';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('sora')
    .description(APP_DESCRIPTION)
    .version(DEFAULT_VERSION, '-v, --version', 'Show version')
    .argument('[prompt]', 'Optional prompt')
    .helpOption('-h, --help', 'Display help')
    .action(async (prompt?: string) => {
      await startCommand({ prompt });
    });

  return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();

  // Handle termination signals gracefully
  const handleSigint = (): void => {
    process.stdout.write('\n');
    process.exit(EXIT_CODES.SUCCESS);
  };

  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigint);

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (isSoraError(error)) {
      console.error(`Error: ${error.message}`);
      process.exit(error.exitCode);
    }

    if (error instanceof Error) {
      logger.error('Unexpected error:', error);
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred.');
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const scriptPath = fs.realpathSync(process.argv[1]);
    return fs.realpathSync(currentFile) === scriptPath;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  run().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT_CODES.ERROR);
  });
}
