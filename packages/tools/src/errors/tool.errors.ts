import { SoraError, EXIT_CODES } from '@sora/core';

export interface ToolErrorOptions {
  toolName?: string;
  toolCallId?: string;
  cause?: unknown;
  exitCode?: number;
}

export class ToolError extends SoraError {
  readonly toolName?: string;
  readonly toolCallId?: string;
  override readonly cause?: unknown;

  constructor(message: string, code = 'TOOL_ERROR', options?: ToolErrorOptions) {
    super(message, code, options?.exitCode ?? EXIT_CODES.ERROR);
    this.name = 'ToolError';
    this.toolName = options?.toolName;
    this.toolCallId = options?.toolCallId;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(toolName: string, toolCallId?: string) {
    super(`Tool "${toolName}" not found.`, 'TOOL_NOT_FOUND', {
      toolName,
      toolCallId,
    });
    this.name = 'ToolNotFoundError';
  }
}

export class ToolValidationError extends ToolError {
  readonly validationErrors: readonly string[];

  constructor(toolName: string, validationErrors: string[], toolCallId?: string) {
    const errorDetails =
      validationErrors.length > 0 ? validationErrors.join('; ') : 'Invalid arguments';
    super(`Invalid arguments for tool "${toolName}": ${errorDetails}`, 'TOOL_VALIDATION_ERROR', {
      toolName,
      toolCallId,
    });
    this.name = 'ToolValidationError';
    this.validationErrors = [...validationErrors];
  }
}

export class ToolExecutionError extends ToolError {
  constructor(toolName: string, message: string, toolCallId?: string, cause?: unknown) {
    super(`Execution of tool "${toolName}" failed: ${message}`, 'TOOL_EXECUTION_ERROR', {
      toolName,
      toolCallId,
      cause,
    });
    this.name = 'ToolExecutionError';
  }
}

export class ToolRegistrationError extends ToolError {
  constructor(toolName: string, message?: string) {
    super(message ?? `Tool "${toolName}" is already registered.`, 'TOOL_REGISTRATION_ERROR', {
      toolName,
    });
    this.name = 'ToolRegistrationError';
  }
}

export class ToolSystemError extends ToolError {
  constructor(message: string, toolName?: string, toolCallId?: string, cause?: unknown) {
    super(message, 'TOOL_SYSTEM_ERROR', {
      toolName,
      toolCallId,
      cause,
    });
    this.name = 'ToolSystemError';
  }
}

export function isToolError(error: unknown): error is ToolError {
  return error instanceof ToolError;
}
