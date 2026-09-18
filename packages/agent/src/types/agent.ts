import type { ToolCall } from '@sora/core';

export type AgentState =
  | 'idle'
  | 'running'
  | 'waiting_for_tool'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentConfig {
  maxIterations?: number;
  maxToolCalls?: number;
  temperature?: number;
  maxTokens?: number;
  cwd?: string;
}

export interface AgentRunOptions {
  signal?: AbortSignal;
  cwd?: string;
  requestId?: string;
}

export type AgentEvent =
  | {
      type: 'agent_started';
      runId: string;
      prompt: string;
    }
  | {
      type: 'iteration_started';
      iteration: number;
    }
  | {
      type: 'llm_started';
      iteration: number;
    }
  | {
      type: 'llm_text_delta';
      content: string;
      iteration: number;
    }
  | {
      type: 'tool_call_started';
      toolCall: ToolCall;
      iteration: number;
    }
  | {
      type: 'tool_call_completed';
      toolCall: ToolCall;
      result: unknown;
      iteration: number;
    }
  | {
      type: 'tool_call_failed';
      toolCall: ToolCall;
      error: Error;
      iteration: number;
    }
  | {
      type: 'agent_completed';
      output: string;
      totalIterations: number;
      totalToolCalls: number;
    }
  | {
      type: 'agent_error';
      error: Error;
    }
  | {
      type: 'agent_cancelled';
      reason?: string;
    };

export interface AgentRunResult {
  success: boolean;
  output: string;
  iterations: number;
  toolCallsCount: number;
  error?: Error;
  cancelled?: boolean;
}
