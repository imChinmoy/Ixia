import type Groq from 'groq-sdk';
import type { ToolDefinition, ToolCall, Message } from '@ixia/core';


/**
 * Converts generic Ixia ToolDefinition array to Groq ChatCompletionTool array.
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
 * Converts an accumulated streaming Groq tool call into a generic Ixia ToolCall.
 */
export function toIxiaToolCall(accumulated: {
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

/**
 * Converts generic Ixia Message array to Groq ChatCompletionMessageParam array,
 * preserving tool calls and tool execution responses.
 */
export function toGroqMessages(
  messages: readonly Message[],
): Groq.Chat.ChatCompletionMessageParam[] {
  return messages.map((m): Groq.Chat.ChatCompletionMessageParam => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: m.content,
      };
    }

    if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments:
                typeof tc.arguments === 'string'
                  ? tc.arguments
                  : JSON.stringify(tc.arguments ?? {}),
            },
          })),
        };
      }
      return {
        role: 'assistant',
        content: m.content,
      };
    }

    if (m.role === 'system') {
      return {
        role: 'system',
        content: m.content,
      };
    }

    return {
      role: 'user',
      content: m.content,
    };
  });
}

