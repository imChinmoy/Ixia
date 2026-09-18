import type { Message } from '@ixia/core';
import type { RepositoryContextSnapshot } from '@ixia/context';

export type PlanStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'failed';

export type PlanStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped'
  | 'failed';

export interface PlanStep {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: PlanStepStatus;
  readonly dependencies: readonly string[];
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly error?: string;
}

export interface Plan {
  readonly id: string;
  readonly goal: string;
  readonly steps: readonly PlanStep[];
  readonly status: PlanStatus;
  readonly currentStepId?: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface PlanningLimits {
  readonly maxSteps: number;
  readonly maxTitleLength: number;
  readonly maxDescriptionLength: number;
  readonly maxGoalLength: number;
}

export const DEFAULT_PLANNING_LIMITS: PlanningLimits = {
  maxSteps: 20,
  maxTitleLength: 150,
  maxDescriptionLength: 500,
  maxGoalLength: 500,
};

export interface PlanningInput {
  readonly prompt: string;
  readonly context?: RepositoryContextSnapshot;
  readonly cwd?: string;
  readonly history?: readonly Message[];
}
