import { EXIT_CODES } from '../constants/index.js';

export class SoraError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code = 'SORA_ERROR', exitCode: number = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'SoraError';
    this.code = code;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends SoraError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class CLIError extends SoraError {
  constructor(message: string, exitCode: number = EXIT_CODES.ERROR) {
    super(message, 'CLI_ERROR', exitCode);
    this.name = 'CLIError';
  }
}

export class ConversationError extends SoraError {
  constructor(message: string, code = 'CONVERSATION_ERROR') {
    super(message, code);
    this.name = 'ConversationError';
  }
}

export class ConversationBusyError extends ConversationError {
  constructor(message = 'A request is already in progress. Please wait until generation finishes.') {
    super(message, 'CONVERSATION_BUSY');
    this.name = 'ConversationBusyError';
  }
}

export function isSoraError(error: unknown): error is SoraError {
  return error instanceof SoraError;
}
