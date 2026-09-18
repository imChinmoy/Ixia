import { describe, it, expect } from 'vitest';
import {
  PlanValidator,
  PlanValidationError,
  PlanLimitError,
  PlanDependencyError,
  type Plan,
  type PlanStep,
} from '@ixia/planner';

describe('PlanValidator', () => {
  const validator = new PlanValidator();

  const createValidPlan = (overrides?: Partial<Plan>): Plan => ({
    id: 'plan-valid',
    goal: 'Build authentication module',
    status: 'ready',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
      {
        id: 'step-1',
        title: 'Design schema',
        status: 'pending',
        dependencies: [],
      },
      {
        id: 'step-2',
        title: 'Implement login route',
        status: 'pending',
        dependencies: ['step-1'],
      },
    ],
    ...overrides,
  });

  it('validates a correct plan without errors', () => {
    const plan = createValidPlan();
    expect(() => validator.validate(plan)).not.toThrow();
  });

  it('rejects an empty goal or whitespace-only goal', () => {
    const plan1 = createValidPlan({ goal: '' });
    expect(() => validator.validate(plan1)).toThrow(PlanValidationError);

    const plan2 = createValidPlan({ goal: '   ' });
    expect(() => validator.validate(plan2)).toThrow(PlanValidationError);
  });

  it('rejects a goal that exceeds maxGoalLength', () => {
    const customValidator = new PlanValidator({ maxGoalLength: 50 });
    const plan = createValidPlan({ goal: 'A'.repeat(51) });
    expect(() => customValidator.validate(plan)).toThrow(PlanLimitError);
  });

  it('rejects an empty steps array', () => {
    const plan = createValidPlan({ steps: [] });
    expect(() => validator.validate(plan)).toThrow(PlanValidationError);
  });

  it('rejects when step count exceeds maxSteps limit', () => {
    const customValidator = new PlanValidator({ maxSteps: 3 });
    const steps: PlanStep[] = [
      { id: 's1', title: 'S1', status: 'pending', dependencies: [] },
      { id: 's2', title: 'S2', status: 'pending', dependencies: [] },
      { id: 's3', title: 'S3', status: 'pending', dependencies: [] },
      { id: 's4', title: 'S4', status: 'pending', dependencies: [] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => customValidator.validate(plan)).toThrow(PlanLimitError);
  });

  it('rejects duplicate step IDs', () => {
    const steps: PlanStep[] = [
      { id: 'dup-id', title: 'Step 1', status: 'pending', dependencies: [] },
      { id: 'dup-id', title: 'Step 2', status: 'pending', dependencies: [] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanValidationError);
  });

  it('rejects invalid or empty step titles', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: '', status: 'pending', dependencies: [] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanValidationError);
  });

  it('rejects step titles that exceed maxTitleLength', () => {
    const customValidator = new PlanValidator({ maxTitleLength: 20 });
    const steps: PlanStep[] = [
      { id: 's1', title: 'A'.repeat(21), status: 'pending', dependencies: [] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => customValidator.validate(plan)).toThrow(PlanLimitError);
  });

  it('rejects dependencies referencing non-existent step IDs', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: 'Step 1', status: 'pending', dependencies: ['non-existent-step'] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanDependencyError);
  });

  it('rejects direct self-referencing dependency (A -> A)', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: 'Step 1', status: 'pending', dependencies: ['s1'] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanDependencyError);
  });

  it('rejects circular dependency between two steps (A -> B -> A)', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: 'Step 1', status: 'pending', dependencies: ['s2'] },
      { id: 's2', title: 'Step 2', status: 'pending', dependencies: ['s1'] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanDependencyError);
  });

  it('rejects indirect circular dependency in larger graphs (A -> B -> C -> A)', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: 'Step 1', status: 'pending', dependencies: ['s3'] },
      { id: 's2', title: 'Step 2', status: 'pending', dependencies: ['s1'] },
      { id: 's3', title: 'Step 3', status: 'pending', dependencies: ['s2'] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).toThrow(PlanDependencyError);
  });

  it('accepts valid complex DAG dependencies (diamond dependency)', () => {
    // s1 -> s2, s1 -> s3, s2 -> s4, s3 -> s4
    const steps: PlanStep[] = [
      { id: 's1', title: 'Foundation', status: 'pending', dependencies: [] },
      { id: 's2', title: 'Service layer', status: 'pending', dependencies: ['s1'] },
      { id: 's3', title: 'Database schema', status: 'pending', dependencies: ['s1'] },
      { id: 's4', title: 'Integration tests', status: 'pending', dependencies: ['s2', 's3'] },
    ];
    const plan = createValidPlan({ steps });
    expect(() => validator.validate(plan)).not.toThrow();
  });
});
