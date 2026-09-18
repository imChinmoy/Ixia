import type { ToolError } from '../errors/tool.errors.js';

export interface ToolExecutionResult<TResult = unknown> {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly result?: TResult;
  readonly error?: ToolError;
}
