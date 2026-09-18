import process from 'node:process';
import chalk from 'chalk';
import { PROMPT_SYMBOL } from '@ixia/core';

export interface TerminalRenderer {
  user(message: string): void;
  system(message: string): void;
  info(message: string): void;
  error(message: string): void;
}

export function createHeaderBox(compact = false): string {
  if (compact) {
    return [
      chalk.cyan('╭────────────────────────────────────────────╮'),
      chalk.cyan('│') +
        chalk.bold.cyan('                 S O R A                    ') +
        chalk.cyan('│'),
      chalk.cyan('╰────────────────────────────────────────────╯'),
    ].join('\n');
  }

  return [
    chalk.cyan('╭────────────────────────────────────────────╮'),
    chalk.cyan('│                                            │'),
    chalk.cyan('│') +
      chalk.bold.cyan('                 S O R A                    ') +
      chalk.cyan('│'),
    chalk.cyan('│                                            │'),
    chalk.cyan('│') + chalk.gray('          AI coding agent for your terminal ') + chalk.cyan('│'),
    chalk.cyan('│                                            │'),
    chalk.cyan('╰────────────────────────────────────────────╯'),
  ].join('\n');
}

export class ConsoleTerminalRenderer implements TerminalRenderer {
  private outputStream: NodeJS.WriteStream;

  constructor(outputStream: NodeJS.WriteStream = process.stdout) {
    this.outputStream = outputStream;
  }

  user(message: string): void {
    this.outputStream.write(`\n${chalk.cyan(PROMPT_SYMBOL)} ${message}\n\n`);
  }

  system(message: string): void {
    this.outputStream.write(`${message}\n`);
  }

  info(message: string): void {
    this.outputStream.write(`${chalk.blue('ℹ')} ${message}\n`);
  }

  error(message: string): void {
    this.outputStream.write(`${chalk.red('✖')} ${message}\n`);
  }
}

export const terminalRenderer = new ConsoleTerminalRenderer();
