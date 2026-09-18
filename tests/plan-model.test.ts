import { describe, it, expect } from 'vitest';
import {
  PlanState,
  InvalidPlanTransitionError,
  PlanDependencyError,
  type PlanStep,
} from '@ixia/planner';

describe('PlanState Model and Lifecycle', () => {
  const sampleSteps: PlanStep[] = [
    {
      id: 'step-1',
      title: 'Analyze workspace and configuration',
      description: 'Check package.json and tsconfig.json',
      status: 'pending',
      dependencies: [],
    },
    {
      id: 'step-2',
      title: 'Implement feature component',
      description: 'Write TypeScript code in src/',
      status: 'pending',
      dependencies: ['step-1'],
    },
    {
      id: 'step-3',
      title: 'Run test suite',
      description: 'Run vitest to verify changes',
      status: 'pending',
      dependencies: ['step-2'],
    },
  ];

  it('creates a new plan with default ready status and initial version', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);
    const snapshot = planState.getSnapshot();

    expect(snapshot.id).toBeDefined();
    expect(snapshot.goal).toBe('Implement feature X');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.version).toBe(1);
    expect(snapshot.steps).toHaveLength(3);
    expect(snapshot.steps[0]!.status).toBe('pending');
  });

  it('returns isolated snapshot copies that do not mutate internal state', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);
    const snap1 = planState.getSnapshot();

    // Mutating snapshot steps array should not affect next snapshot
    (snap1.steps as PlanStep[]).push({
      id: 'injected-step',
      title: 'Malicious injected step',
      status: 'pending',
      dependencies: [],
    });

    const snap2 = planState.getSnapshot();
    expect(snap2.steps).toHaveLength(3);
  });

  it('transitions to in_progress when started', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);
    const updated = planState.start();

    expect(updated.status).toBe('in_progress');
    expect(updated.version).toBe(2);
  });

  it('returns next executable step respecting dependencies', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);

    // Initial executable step must be step-1 (has no dependencies)
    const next1 = planState.getNextExecutableStep();
    expect(next1?.id).toBe('step-1');

    // Start step-1
    planState.startStep('step-1');
    // While step-1 is in_progress, step-2 is NOT executable because step-1 is not completed
    const next2 = planState.getNextExecutableStep();
    expect(next2).toBeUndefined();

    // Complete step-1
    planState.completeStep('step-1');

    // Now step-2 should be executable
    const next3 = planState.getNextExecutableStep();
    expect(next3?.id).toBe('step-2');
  });

  it('throws PlanDependencyError when trying to start a step with unmet dependencies', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);

    expect(() => planState.startStep('step-2')).toThrow(PlanDependencyError);
  });

  it('allows skipping a dependency and treats skipped dependency as satisfied', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);

    // Skip step-1
    planState.skipStep('step-1', 'Not needed for this project');
    const step1 = planState.getStep('step-1');
    expect(step1?.status).toBe('skipped');

    // step-2 should now be executable
    const next = planState.getNextExecutableStep();
    expect(next?.id).toBe('step-2');

    // And step-2 can be started
    expect(() => planState.startStep('step-2')).not.toThrow();
  });

  it('handles step failure and block status', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);

    // Block step-2 while plan is active
    planState.blockStep('step-2', 'Waiting for upstream bug fix');
    const step2 = planState.getStep('step-2');
    expect(step2?.status).toBe('blocked');
    expect(step2?.error).toBe('Waiting for upstream bug fix');

    // Fail step-1, which transitions plan status to failed
    planState.startStep('step-1');
    planState.failStep('step-1', 'Build failed with syntax error');

    const step1 = planState.getStep('step-1');
    expect(step1?.status).toBe('failed');
    expect(step1?.error).toBe('Build failed with syntax error');
    expect(planState.getSnapshot().status).toBe('failed');
  });

  it('supports dynamically adding and updating steps', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);

    // Add step-4
    planState.addStep({
      id: 'step-4',
      title: 'Deploy to staging',
      description: 'Run deployment script',
      status: 'pending',
      dependencies: ['step-3'],
    });

    expect(planState.getSnapshot().steps).toHaveLength(4);

    // Update step-4 description
    planState.updateStep('step-4', {
      description: 'Run staging deployment with verification',
    });

    expect(planState.getStep('step-4')?.description).toBe(
      'Run staging deployment with verification',
    );
  });

  it('completes plan when all non-skipped steps are completed', () => {
    const planState = PlanState.create('Implement feature X', [
      {
        id: 'step-1',
        title: 'Step 1',
        status: 'pending',
        dependencies: [],
      },
      {
        id: 'step-2',
        title: 'Step 2',
        status: 'pending',
        dependencies: ['step-1'],
      },
    ]);

    planState.startStep('step-1');
    planState.completeStep('step-1');
    planState.startStep('step-2');
    planState.completeStep('step-2');

    const completedPlan = planState.complete();
    expect(completedPlan.status).toBe('completed');
  });

  it('cancels plan and prevents further transitions', () => {
    const planState = PlanState.create('Implement feature X', sampleSteps);
    planState.startStep('step-1');
    planState.cancel('Cancelled by user');

    const snapshot = planState.getSnapshot();
    expect(snapshot.status).toBe('cancelled');
    expect(snapshot.metadata?.cancellationReason).toBe('Cancelled by user');

    expect(() => planState.startStep('step-2')).toThrow(InvalidPlanTransitionError);
  });
});
