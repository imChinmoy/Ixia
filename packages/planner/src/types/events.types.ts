import type { Plan, PlanStep } from './plan.types.js';

export type PlanEvent =
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
    };
