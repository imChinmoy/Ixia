import type Groq from 'groq-sdk';
import type { ToolDefinition, ToolCall } from '@sora/core';

/**
 * Converts generic Sora ToolDefinition array to Groq ChatCompletionTool array.
 */
export function toGroqTools(
  tools?: readonly ToolDefinition[],
): Groq.Chat.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: tool.inputSchema.type,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required ? [...tool.inputSchema.required] : undefined,
        additionalProperties: tool.inputSchema.additionalProperties,
      },
    },
  }));
}

/**
 * Converts an accumulated streaming Groq tool call into a generic Sora ToolCall.
 */
export function toSoraToolCall(accumulated: {
  id: string;
  name: string;
  argumentsBuffer: string;
}): ToolCall {
  let parsedArgs: Record<string, unknown> = {};

  const trimmedBuffer = accumulated.argumentsBuffer.trim();
  if (trimmedBuffer) {
    try {
      const parsed = JSON.parse(trimmedBuffer);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        parsedArgs = parsed as Record<string, unknown>;
      } else {
        parsedArgs = { _raw: parsed };
      }
    } catch {
      // If LLM produced malformed JSON, keep raw so ToolExecutor validation catches it
      parsedArgs = { _raw: trimmedBuffer };
    }
  }

  return {
    id: accumulated.id || `call_${Math.random().toString(36).substring(2, 9)}`,
    name: accumulated.name,
    arguments: parsedArgs,
  };
}
