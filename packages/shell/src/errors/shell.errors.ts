import { ToolError, type ToolErrorOptions } from '@sora/tools';

export class ShellError extends ToolError {
  constructor(message: string, code = 'SHELL_ERROR', options?: ToolErrorOptions) {
    super(message, code, options);
    this.name = 'ShellError';
  }
}

export class CommandStartError extends ShellError {
  readonly command: string;

  constructor(
    command: string,
    message: string,
    toolName?: string,
    toolCallId?: string,
    cause?: unknown,
  ) {
    super(`Failed to start command "${command}": ${message}`, 'COMMAND_START_ERROR', {
      toolName,
      toolCallId,
      cause,
    });
    this.name = 'CommandStartError';
    this.command = command;
  }
}

export class CommandTimeoutError extends ShellError {
  readonly command: string;
  readonly timeoutMs: number;

  constructor(
    command: string,
    timeoutMs: number,
    toolName?: string,
    toolCallId?: string,
  ) {
    super(`Command "${command}" timed out after ${timeoutMs}ms.`, 'COMMAND_TIMEOUT_ERROR', {
      toolName,
      toolCallId,
    });
    this.name = 'CommandTimeoutError';
    this.command = command;
    this.timeoutMs = timeoutMs;
  }
}

export class CommandAbortedError extends ShellError {
  readonly command: string;

  constructor(
    command: string,
    toolName?: string,
    toolCallId?: string,
    cause?: unknown,
  ) {
    super(`Command "${command}" was aborted.`, 'COMMAND_ABORTED_ERROR', {
      toolName,
      toolCallId,
      cause,
    });
    this.name = 'CommandAbortedError';
    this.command = command;
  }
}

export function isShellError(error: unknown): error is ShellError {
  return error instanceof ShellError;
}
