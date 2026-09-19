import { describe, it, expect } from 'vitest';
import { ToolExecutor, ToolRegistry } from '@ixia/tools';
import { registerShellTools } from '@ixia/shell';
import {
  VerifierService,
  type VerificationFailure,
} from '@ixia/verification';
import type { Plan, PlanStep } from '@ixia/planner';

describe('VerifierService Facade', () => {
  const registry = new ToolRegistry();
  registerShellTools(registry);
  const toolExecutor = new ToolExecutor({ registry });
  const verifier = new VerifierService({ toolExecutor });

  it('should expose verification policy, runner, and recovery policy', () => {
    expect(verifier.getPolicy()).toBeDefined();
    expect(verifier.getRunner()).toBeDefined();
    expect(verifier.getAnalyzer()).toBeDefined();
    expect(verifier.getRecoveryPolicy().maxVerificationAttempts).toBe(3);
  });

  it('should format compact structured failure context for LLM', () => {
    const failures: VerificationFailure[] = [
      {
        id: 'f-1',
        category: 'type_error',
        message: "Property 'token' does not exist on type 'Session'",
        file: 'src/auth/session.ts',
        line: 25,
        column: 10,
        recoverable: true,
      },
    ];

    const context = verifier.formatFailureContext(
      failures,
      'Add session token validation',
      {
        id: 'chk-1',
        type: 'typecheck',
        name: 'TypeScript typecheck',
        status: 'failed',
        exitCode: 2,
        output: "src/auth/session.ts:25:10 - error TS2339: Property 'token' does not exist on type 'Session'.",
      },
    );

    expect(context).toContain('VERIFICATION FAILURE');
    expect(context).toContain('Task:\nAdd session token validation');
    expect(context).toContain('Check:\nTypeScript typecheck');
    expect(context).toContain('Status:\nFAILED');
    expect(context).toContain('Exit code:\n2');
    expect(context).toContain("Property 'token' does not exist on type 'Session'");
    expect(context).toContain('Required action:');
  });

  it('should verify an informational step without executing unnecessary commands', async () => {
    const step: PlanStep = {
      id: 'step-1',
      title: 'Inspect repository architecture',
      description: 'Review directory layout and packages',
      status: 'pending',
      dependencies: [],
    };
    const plan: Plan = {
      id: 'p-1',
      goal: 'Explore codebase',
      steps: [step],
      status: 'in_progress',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await verifier.verifyStep(step, plan);

    expect(result.status).toBe('passed');
    expect(result.checks).toHaveLength(0);
    expect(result.summary).toContain('no verification checks required');
  });
});
