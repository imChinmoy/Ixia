import process from 'node:process';
import type { ToolRegistry } from '../registry/tool-registry.js';
import type { ToolCall } from '../types/tool-call.js';
import type { ToolExecutionContext } from '../types/execution-context.js';
import type { ToolExecutionResult } from '../types/tool-result.js';
import { validateToolInput } from '../validation/tool-validator.js';
import {
  ToolError,
  ToolNotFoundError,
  ToolValidationError,
  ToolExecutionError,
  ToolSystemError,
} from '../errors/tool.errors.js';

export interface ToolExecutorOptions {
  registry: ToolRegistry;
  defaultCwd?: string;
}

export class ToolExecutor {
  private readonly registry: ToolRegistry;
  private readonly defaultCwd: string;

  constructor(options: ToolExecutorOptions) {
    this.registry = options.registry;
    this.defaultCwd = options.defaultCwd ?? process.cwd();
  }

  getRegistry(): ToolRegistry {
    return this.registry;
  }

  async execute(
    toolCall: ToolCall,
    context?: Partial<ToolExecutionContext>,
  ): Promise<ToolExecutionResult> {
    if (!toolCall || typeof toolCall !== 'object') {
      return {
        toolCallId: '',
        toolName: '',
        success: false,
        error: new ToolSystemError('Invalid tool call payload: expected an object.'),
      };
    }

    const { id: toolCallId = '', name: toolName = '', arguments: rawArgs } = toolCall;

    if (!toolName) {
      return {
        toolCallId,
        toolName: '',
        success: false,
        error: new ToolNotFoundError('', toolCallId),
      };
    }

    // 1. Discover tool from registry
    const tool = this.registry.get(toolName);
    if (!tool) {
      return {
        toolCallId,
        toolName,
        success: false,
        error: new ToolNotFoundError(toolName, toolCallId),
      };
    }

    // 2. Validate input schema
    const validation = validateToolInput(tool.inputSchema, rawArgs);
    if (!validation.valid) {
      return {
        toolCallId,
        toolName,
        success: false,
        error: new ToolValidationError(toolName, validation.errors, toolCallId),
      };
    }

    // 3. Construct isolated execution context for this call
    const executionContext: ToolExecutionContext = {
      cwd: context?.cwd ?? this.defaultCwd,
      signal: context?.signal,
      requestId: context?.requestId,
    };

    // 4. Check if already aborted
    if (executionContext.signal?.aborted) {
      return {
        toolCallId,
        toolName,
        success: false,
        error: new ToolExecutionError(
          toolName,
          'Tool execution was aborted.',
          toolCallId,
          executionContext.signal.reason,
        ),
      };
    }

    // 5. Execute tool and normalize result / errors
    try {
      const result = await tool.execute(rawArgs, executionContext);
      return {
        toolCallId,
        toolName,
        success: true,
        result,
      };
    } catch (error) {
      const normalizedError =
        error instanceof ToolError
          ? error
          : new ToolExecutionError(
              toolName,
              error instanceof Error ? error.message : String(error),
              toolCallId,
              error,
            );

      return {
        toolCallId,
        toolName,
        success: false,
        error: normalizedError,
      };
    }
  }
}
