import type { LLMProvider } from '@sora/core';
import type { Plan, PlanningInput, PlanningLimits, PlanStep } from './types/plan.types.js';
import { PlanValidator } from './validation/plan-validator.js';
import { PlanState } from './state/plan-state.js';
import { type PlanningPolicy, DefaultPlanningPolicy } from './policy/planning-policy.js';
import { PlanGenerator } from './generation/plan-generator.js';

export interface PlannerServiceOptions {
  policy?: PlanningPolicy;
  generator?: PlanGenerator;
  validator?: PlanValidator;
  limits?: Partial<PlanningLimits>;
}

export class PlannerService {
  readonly policy: PlanningPolicy;
  readonly generator: PlanGenerator;
  readonly validator: PlanValidator;

  constructor(options?: PlannerServiceOptions) {
    this.validator = options?.validator ?? new PlanValidator(options?.limits);
    this.policy = options?.policy ?? new DefaultPlanningPolicy();
    this.generator = options?.generator ?? new PlanGenerator(this.validator);
  }

  shouldPlan(input: PlanningInput): boolean {
    return this.policy.shouldPlan(input);
  }

  isPlanOnly(prompt: string): boolean {
    return this.policy.isPlanOnlyRequest(prompt);
  }

  async generatePlan(
    input: PlanningInput,
    provider: LLMProvider,
    options?: { signal?: AbortSignal },
  ): Promise<Plan> {
    return this.generator.generate(input, provider, options);
  }

  createPlanState(plan: Plan): PlanState {
    return new PlanState(plan, this.validator);
  }

  /**
   * Formats a plan into a clean text block for CLI display.
   */
  formatPlanForDisplay(plan: Plan): string {
    const lines: string[] = [];
    const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
    lines.push(`Plan · ${plan.goal} (${completedCount}/${plan.steps.length} completed)`);
    lines.push('');

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      const marker = this.getStepMarker(step, plan.currentStepId);
      lines.push(`${i + 1}. ${marker} ${step.title}`);
    }

    return lines.join('\n');
  }

  /**
   * Formats a compact plan representation to inject into the AgentLoop system prompt.
   */
  formatPlanForPrompt(plan: Plan): string {
    const currentStep = plan.steps.find((s) => s.id === plan.currentStepId);
    const lines: string[] = [];

    lines.push('[Active Plan]');
    lines.push(`Goal: ${plan.goal}`);

    if (currentStep) {
      lines.push(`Current Step: ${currentStep.title} (${currentStep.id})`);
      if (currentStep.description) {
        lines.push(`Current Step Focus: ${currentStep.description}`);
      }
    }

    lines.push('Progress:');
    for (const step of plan.steps) {
      let mark = '[ ]';
      if (step.status === 'completed') mark = '[✓]';
      else if (step.status === 'skipped') mark = '[⊘]';
      else if (step.status === 'in_progress') mark = '[→]';
      else if (step.status === 'failed') mark = '[×]';
      else if (step.status === 'blocked') mark = '[!]';

      const activeTag = step.id === plan.currentStepId ? ' (CURRENT STEP)' : '';
      lines.push(`${mark} ${step.id}: ${step.title}${activeTag}`);
    }

    return lines.join('\n');
  }

  private getStepMarker(step: PlanStep, currentStepId?: string): string {
    if (step.id === currentStepId || step.status === 'in_progress') {
      return '→';
    }
    switch (step.status) {
      case 'completed':
        return '✓';
      case 'skipped':
        return '⊘';
      case 'failed':
        return '×';
      case 'blocked':
        return '!';
      case 'pending':
      default:
        return '○';
    }
  }
}
