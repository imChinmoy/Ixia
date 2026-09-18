import type {
  Plan,
  PlanStep,
  PlanningLimits,
} from '../types/plan.types.js';
import { DEFAULT_PLANNING_LIMITS } from '../types/plan.types.js';
import {
  PlanValidationError,
  PlanLimitError,
  PlanDependencyError,
} from '../errors/planner.errors.js';

export class PlanValidator {
  private readonly limits: PlanningLimits;

  constructor(limits?: Partial<PlanningLimits>) {
    this.limits = { ...DEFAULT_PLANNING_LIMITS, ...limits };
  }

  /**
   * Validates a complete or candidate Plan structure, throwing specific errors
   * if any rule, limit, or dependency constraint is violated.
   */
  validate(candidate: unknown): asserts candidate is Plan {
    if (!candidate || typeof candidate !== 'object') {
      throw new PlanValidationError('Plan must be a non-null object');
    }

    const plan = candidate as Record<string, unknown>;

    // 1. Goal validation
    if (typeof plan.goal !== 'string' || !plan.goal.trim()) {
      throw new PlanValidationError('Plan goal must be a non-empty string');
    }

    if (plan.goal.length > this.limits.maxGoalLength) {
      throw new PlanLimitError(
        `Plan goal exceeds maximum length of ${this.limits.maxGoalLength} characters`,
      );
    }

    // 2. Steps presence and count
    if (!Array.isArray(plan.steps)) {
      throw new PlanValidationError('Plan steps must be an array');
    }

    if (plan.steps.length === 0) {
      throw new PlanValidationError('Plan must contain at least one step');
    }

    if (plan.steps.length > this.limits.maxSteps) {
      throw new PlanLimitError(
        `Plan exceeds maximum allowed steps (${this.limits.maxSteps}). Found ${plan.steps.length} steps.`,
      );
    }

    // 3. Step validation
    const stepIds = new Set<string>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i] as Record<string, unknown>;
      if (!step || typeof step !== 'object') {
        throw new PlanValidationError(`Step at index ${i} is not a valid object`);
      }

      // Step ID
      if (typeof step.id !== 'string' || !step.id.trim()) {
        throw new PlanValidationError(`Step at index ${i} has an invalid or missing id`);
      }

      const cleanId = step.id.trim();

      if (stepIds.has(cleanId)) {
        throw new PlanValidationError(
          `Duplicate step ID detected: "${cleanId}". Step IDs must be unique.`,
        );
      }
      stepIds.add(cleanId);

      // Step Title
      if (typeof step.title !== 'string' || !step.title.trim()) {
        throw new PlanValidationError(`Step "${cleanId}" must have a non-empty title`);
      }

      if (step.title.length > this.limits.maxTitleLength) {
        throw new PlanLimitError(
          `Step "${cleanId}" title exceeds limit of ${this.limits.maxTitleLength} characters`,
        );
      }

      // Step Description
      if (
        step.description !== undefined &&
        typeof step.description === 'string' &&
        step.description.length > this.limits.maxDescriptionLength
      ) {
        throw new PlanLimitError(
          `Step "${cleanId}" description exceeds limit of ${this.limits.maxDescriptionLength} characters`,
        );
      }

      // Dependencies array
      if (step.dependencies !== undefined && !Array.isArray(step.dependencies)) {
        throw new PlanValidationError(
          `Step "${cleanId}" dependencies must be an array of step IDs`,
        );
      }
    }

    // 4. Dependency graph validation
    const stepList = plan.steps as PlanStep[];
    const stepMap = new Map<string, PlanStep>();
    for (const step of stepList) {
      stepMap.set(step.id, step);
    }

    for (const step of stepList) {
      const deps = step.dependencies ?? [];

      for (const depId of deps) {
        // Self-dependency
        if (depId === step.id) {
          throw new PlanDependencyError(
            `Step "${step.id}" cannot depend on itself (self-dependency)`,
          );
        }

        // Missing dependency reference
        if (!stepMap.has(depId)) {
          throw new PlanDependencyError(
            `Step "${step.id}" depends on non-existent step "${depId}"`,
          );
        }
      }
    }

    // 5. Dependency cycle detection (DFS with 3-state graph coloring)
    // 0 = unvisited, 1 = visiting (in current path), 2 = visited
    const state = new Map<string, 0 | 1 | 2>();
    for (const id of stepIds) {
      state.set(id, 0);
    }

    const checkCycle = (nodeId: string, pathStack: string[]): void => {
      state.set(nodeId, 1);
      pathStack.push(nodeId);

      const step = stepMap.get(nodeId);
      const deps = step?.dependencies ?? [];

      for (const depId of deps) {
        const depState = state.get(depId);
        if (depState === 1) {
          // Cycle detected!
          const cyclePath = [...pathStack, depId].join(' -> ');
          throw new PlanDependencyError(
            `Dependency cycle detected in plan: ${cyclePath}`,
          );
        }

        if (depState === 0) {
          checkCycle(depId, pathStack);
        }
      }

      pathStack.pop();
      state.set(nodeId, 2);
    };

    for (const id of stepIds) {
      if (state.get(id) === 0) {
        checkCycle(id, []);
      }
    }
  }
}
