import { SoraError } from '@sora/core';

export class PlannerError extends SoraError {
  constructor(message: string, code = 'PLANNER_ERROR') {
    super(message, code);
    this.name = 'PlannerError';
  }
}

export class PlanGenerationError extends PlannerError {
  constructor(message: string, override readonly cause?: unknown) {
    super(message, 'PLAN_GENERATION_ERROR');
    this.name = 'PlanGenerationError';
  }
}

export class PlanValidationError extends PlannerError {
  constructor(message: string, readonly details?: readonly string[]) {
    super(message, 'PLAN_VALIDATION_ERROR');
    this.name = 'PlanValidationError';
  }
}

export class PlanLimitError extends PlannerError {
  constructor(message: string) {
    super(message, 'PLAN_LIMIT_ERROR');
    this.name = 'PlanLimitError';
  }
}

export class InvalidPlanTransitionError extends PlannerError {
  constructor(fromStatus: string, toStatus: string, reason?: string) {
    const extra = reason ? `: ${reason}` : '';
    super(
      `Invalid plan transition from "${fromStatus}" to "${toStatus}"${extra}`,
      'INVALID_PLAN_TRANSITION',
    );
    this.name = 'InvalidPlanTransitionError';
  }
}

export class PlanDependencyError extends PlannerError {
  constructor(message: string) {
    super(message, 'PLAN_DEPENDENCY_ERROR');
    this.name = 'PlanDependencyError';
  }
}
