import { EXIT_CODES } from '../constants/index.js';

export class IxiaError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, code = 'IXIA_ERROR', exitCode: number = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'IxiaError';
    this.code = code;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends IxiaError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class CLIError extends IxiaError {
  constructor(message: string, exitCode: number = EXIT_CODES.ERROR) {
    super(message, 'CLI_ERROR', exitCode);
    this.name = 'CLIError';
  }
}

export class ConversationError extends IxiaError {
  constructor(message: string, code = 'CONVERSATION_ERROR') {
    super(message, code);
    this.name = 'ConversationError';
  }
}

export class ConversationBusyError extends ConversationError {
  constructor(
    message = 'A request is already in progress. Please wait until generation finishes.',
  ) {
    super(message, 'CONVERSATION_BUSY');
    this.name = 'ConversationBusyError';
  }
}

export function isIxiaError(error: unknown): error is IxiaError {
  return error instanceof IxiaError;
}
