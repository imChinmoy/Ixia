import {
  type ToolCall,
  type Message,
  createToolResultMessage,
} from '@ixia/core';
import type { ToolExecutor, ToolExecutionContext } from '@ixia/tools';
import { logger } from '@ixia/logger';

export interface ToolCallExecution {
  toolCall: ToolCall;
  success: boolean;
  result?: unknown;
  error?: Error;
  message: Message;
}

export class ToolCallHandler {
  private readonly toolExecutor: ToolExecutor;

  constructor(toolExecutor: ToolExecutor) {
    this.toolExecutor = toolExecutor;
  }

  /**
   * Executes a single tool call through the ToolExecutor and formats
   * the outcome into a standardized Message with role: 'tool'.
   */
  async handle(
    toolCall: ToolCall,
    context?: Partial<ToolExecutionContext>,
  ): Promise<ToolCallExecution> {
    logger.debug(`[ToolCallHandler] Executing ${toolCall.name} (${toolCall.id})`);

    const executionResult = await this.toolExecutor.execute(toolCall, context);

    if (executionResult.success) {
      const content =
        typeof executionResult.result === 'string'
          ? executionResult.result
          : JSON.stringify(executionResult.result ?? null, null, 2);

      const message = createToolResultMessage(toolCall.id, toolCall.name, content);

      logger.debug(`[ToolCallHandler] Success: ${toolCall.name} (${toolCall.id})`);

      return {
        toolCall,
        success: true,
        result: executionResult.result,
        message,
      };
    }

    const error =
      executionResult.error instanceof Error
        ? executionResult.error
        : new Error(String(executionResult.error ?? 'Unknown tool error'));

    const errorPayload = {
      error: error.message,
      name: error.name,
    };

    const content = JSON.stringify(errorPayload, null, 2);
    const message = createToolResultMessage(toolCall.id, toolCall.name, content);

    logger.debug(
      `[ToolCallHandler] Failed: ${toolCall.name} (${toolCall.id}): ${error.message}`,
    );

    return {
      toolCall,
      success: false,
      error,
      message,
    };
  }
}
