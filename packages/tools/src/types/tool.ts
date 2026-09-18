import type { ToolSchema } from './tool-schema.js';
import type { ToolExecutionContext } from './execution-context.js';

export interface Tool<TInput = unknown, TResult = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;

  execute(input: TInput, context: ToolExecutionContext): Promise<TResult>;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
}
