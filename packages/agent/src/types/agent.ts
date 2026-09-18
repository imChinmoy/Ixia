import type { ToolCall } from '@ixia/core';
import type { RepositoryContextSnapshot } from '@ixia/context';
import type { Plan, PlanStep } from '@ixia/planner';

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
  skipContext?: boolean;
  skipPlanning?: boolean;
  forcePlan?: boolean;
}

export type AgentEvent =
  | {
      type: 'agent_started';
      runId: string;
      prompt: string;
    }
  | {
      type: 'context_build_started';
    }
  | {
      type: 'context_build_completed';
      snapshot: RepositoryContextSnapshot;
    }
  | {
      type: 'context_build_failed';
      error: Error;
    }
  | {
      type: 'plan_created';
      plan: Plan;
    }
  | {
      type: 'plan_ready';
      plan: Plan;
    }
  | {
      type: 'plan_started';
      plan: Plan;
    }
  | {
      type: 'step_started';
      planId: string;
      step: PlanStep;
    }
  | {
      type: 'step_completed';
      planId: string;
      step: PlanStep;
    }
  | {
      type: 'step_skipped';
      planId: string;
      step: PlanStep;
      reason?: string;
    }
  | {
      type: 'step_blocked';
      planId: string;
      step: PlanStep;
      reason?: string;
    }
  | {
      type: 'step_failed';
      planId: string;
      step: PlanStep;
      error: Error;
    }
  | {
      type: 'plan_updated';
      plan: Plan;
      change: string;
    }
  | {
      type: 'plan_completed';
      plan: Plan;
    }
  | {
      type: 'plan_failed';
      plan: Plan;
      error: Error;
    }
  | {
      type: 'plan_cancelled';
      plan: Plan;
      reason?: string;
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
