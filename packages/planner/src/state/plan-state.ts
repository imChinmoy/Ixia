import { randomUUID } from 'node:crypto';
import type {
  Plan,
  PlanStep,
} from '../types/plan.types.js';
import {
  InvalidPlanTransitionError,
  PlanValidationError,
  PlanDependencyError,
} from '../errors/planner.errors.js';
import { PlanValidator } from '../validation/plan-validator.js';

export class PlanState {
  private plan: Plan;
  private readonly validator: PlanValidator;

  constructor(plan: Plan, validator?: PlanValidator) {
    this.validator = validator ?? new PlanValidator();
    this.validator.validate(plan);
    this.plan = { ...plan };
  }

  static create(
    goal: string,
    steps: readonly PlanStep[],
    options?: { id?: string; metadata?: Record<string, unknown>; validator?: PlanValidator },
  ): PlanState {
    const validator: PlanValidator = options?.validator ?? new PlanValidator();
    const id = options?.id ?? `plan-${randomUUID()}`;
    const now = new Date();

    const plan: Plan = {
      id,
      goal,
      steps: steps.map((s) => ({
        ...s,
        status: s.status ?? 'pending',
        dependencies: [...(s.dependencies ?? [])],
      })),
      status: 'ready',
      version: 1,
      createdAt: now,
      updatedAt: now,
      metadata: options?.metadata,
    };

    validator.validate(plan);
    return new PlanState(plan, validator);
  }

  getSnapshot(): Readonly<Plan> {
    return {
      ...this.plan,
      steps: this.plan.steps.map((s) => ({
        ...s,
        dependencies: [...s.dependencies],
      })),
    };
  }

  getStep(stepId: string): PlanStep | undefined {
    return this.plan.steps.find((s) => s.id === stepId);
  }

  /**
   * Returns the next pending step whose dependencies are all satisfied.
   */
  getNextExecutableStep(): PlanStep | undefined {
    if (this.plan.status === 'completed' || this.plan.status === 'cancelled') {
      return undefined;
    }

    for (const step of this.plan.steps) {
      if (step.status === 'pending' && this.areDependenciesSatisfied(step.id)) {
        return step;
      }
    }

    return undefined;
  }

  /**
   * Checks if all dependencies for a step have been completed or skipped.
   */
  areDependenciesSatisfied(stepId: string): boolean {
    const step = this.getStep(stepId);
    if (!step) {
      return false;
    }

    for (const depId of step.dependencies) {
      const dep = this.getStep(depId);
      if (!dep || (dep.status !== 'completed' && dep.status !== 'skipped')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transitions plan to in_progress.
   */
  start(): Readonly<Plan> {
    this.assertNotTerminal('start');
    if (this.plan.status === 'in_progress') {
      return this.getSnapshot();
    }

    this.plan = {
      ...this.plan,
      status: 'in_progress',
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Starts a specific step, setting currentStepId.
   */
  startStep(stepId: string): Readonly<Plan> {
    this.assertNotTerminal(`start step "${stepId}"`);

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const step = this.plan.steps[stepIndex]!;
    if (step.status !== 'pending' && step.status !== 'in_progress') {
      throw new InvalidPlanTransitionError(
        step.status,
        'in_progress',
        `Step "${stepId}" is already ${step.status}`,
      );
    }

    if (!this.areDependenciesSatisfied(stepId)) {
      throw new PlanDependencyError(
        `Cannot start step "${stepId}" because its dependencies are not satisfied`,
      );
    }

    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'in_progress',
      startedAt: step.startedAt ?? new Date(),
    };

    this.plan = {
      ...this.plan,
      status: 'in_progress',
      currentStepId: stepId,
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Marks a step as completed.
   */
  completeStep(stepId: string): Readonly<Plan> {
    this.assertNotTerminal(`complete step "${stepId}"`);

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const step = this.plan.steps[stepIndex]!;
    if (step.status !== 'in_progress' && step.status !== 'pending') {
      throw new InvalidPlanTransitionError(
        step.status,
        'completed',
        `Step "${stepId}" must be pending or in_progress to be completed`,
      );
    }

    const now = new Date();
    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'completed',
      completedAt: now,
    };

    const nextPending = updatedSteps.find(
      (s) => s.status === 'pending' && s.id !== stepId,
    );

    this.plan = {
      ...this.plan,
      currentStepId: nextPending?.id,
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: now,
    };

    return this.getSnapshot();
  }

  /**
   * Marks a step as skipped.
   */
  skipStep(stepId: string, reason?: string): Readonly<Plan> {
    this.assertNotTerminal(`skip step "${stepId}"`);

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const step = this.plan.steps[stepIndex]!;
    const now = new Date();

    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'skipped',
      description: reason
        ? `${step.description ? step.description + ' ' : ''}[Skipped: ${reason}]`
        : step.description,
      completedAt: now,
    };

    this.plan = {
      ...this.plan,
      currentStepId:
        this.plan.currentStepId === stepId ? undefined : this.plan.currentStepId,
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: now,
    };

    return this.getSnapshot();
  }

  /**
   * Marks a step as blocked.
   */
  blockStep(stepId: string, reason?: string): Readonly<Plan> {
    this.assertNotTerminal(`block step "${stepId}"`);

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const step = this.plan.steps[stepIndex]!;
    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'blocked',
      error: reason,
    };

    this.plan = {
      ...this.plan,
      status: 'blocked',
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Marks a step as failed.
   */
  failStep(stepId: string, error?: string): Readonly<Plan> {
    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const step = this.plan.steps[stepIndex]!;
    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'failed',
      error,
    };

    this.plan = {
      ...this.plan,
      status: 'failed',
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Inserts a new step into the plan.
   */
  addStep(step: PlanStep, afterStepId?: string): Readonly<Plan> {
    this.assertNotTerminal('add step');

    const updatedSteps = [...this.plan.steps];
    if (afterStepId) {
      const idx = updatedSteps.findIndex((s) => s.id === afterStepId);
      if (idx === -1) {
        throw new PlanValidationError(`Step "${afterStepId}" does not exist in plan`);
      }
      updatedSteps.splice(idx + 1, 0, step);
    } else {
      updatedSteps.push(step);
    }

    const candidatePlan: Plan = {
      ...this.plan,
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    this.validator.validate(candidatePlan);
    this.plan = candidatePlan;

    return this.getSnapshot();
  }

  /**
   * Updates an existing step's properties.
   */
  updateStep(
    stepId: string,
    updates: Partial<Omit<PlanStep, 'id'>>,
  ): Readonly<Plan> {
    this.assertNotTerminal(`update step "${stepId}"`);

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new PlanValidationError(`Step "${stepId}" does not exist in plan`);
    }

    const existing = this.plan.steps[stepIndex]!;
    const updatedSteps = [...this.plan.steps];
    updatedSteps[stepIndex] = {
      ...existing,
      ...updates,
      id: existing.id, // ID remains immutable
    };

    const candidatePlan: Plan = {
      ...this.plan,
      steps: updatedSteps,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    this.validator.validate(candidatePlan);
    this.plan = candidatePlan;

    return this.getSnapshot();
  }

  /**
   * Marks the entire plan as completed.
   */
  complete(): Readonly<Plan> {
    this.assertNotTerminal('complete plan');

    this.plan = {
      ...this.plan,
      status: 'completed',
      currentStepId: undefined,
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Marks the entire plan as cancelled.
   */
  cancel(reason?: string): Readonly<Plan> {
    if (this.plan.status === 'cancelled') {
      return this.getSnapshot();
    }

    this.plan = {
      ...this.plan,
      status: 'cancelled',
      currentStepId: undefined,
      metadata: {
        ...this.plan.metadata,
        cancellationReason: reason,
      },
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  /**
   * Marks the entire plan as failed.
   */
  fail(error?: string): Readonly<Plan> {
    this.plan = {
      ...this.plan,
      status: 'failed',
      metadata: {
        ...this.plan.metadata,
        failureReason: error,
      },
      version: this.plan.version + 1,
      updatedAt: new Date(),
    };

    return this.getSnapshot();
  }

  private assertNotTerminal(action: string): void {
    if (
      this.plan.status === 'completed' ||
      this.plan.status === 'cancelled' ||
      this.plan.status === 'failed'
    ) {
      throw new InvalidPlanTransitionError(
        this.plan.status,
        'modified',
        `Cannot ${action} when plan is ${this.plan.status}`,
      );
    }
  }
}
