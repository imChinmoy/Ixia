import { describe, it, expect } from 'vitest';
import type {
  VerificationCheck,
  VerificationEvidence,
  VerificationFailure,
  VerificationResult,
  VerificationStatus,
} from '@ixia/verification';
import { DEFAULT_RECOVERY_POLICY } from '@ixia/verification';

describe('Verification Data Model', () => {
  it('should represent a structured verification check', () => {
    const check: VerificationCheck = {
      id: 'check-1',
      type: 'typecheck',
      name: 'TypeScript typecheck',
      description: 'Verifies type safety',
      status: 'pending',
      command: 'pnpm typecheck',
    };

    expect(check.id).toBe('check-1');
    expect(check.type).toBe('typecheck');
    expect(check.status).toBe('pending');
    expect(check.command).toBe('pnpm typecheck');
  });

  it('should represent completed check with duration and exit code', () => {
    const check: VerificationCheck = {
      id: 'check-2',
      type: 'test',
      name: 'Unit tests',
      status: 'passed',
      command: 'pnpm test',
      exitCode: 0,
      durationMs: 450,
      output: 'All 15 tests passed',
    };

    expect(check.status).toBe('passed');
    expect(check.exitCode).toBe(0);
    expect(check.durationMs).toBe(450);
  });

  it('should represent concrete verification evidence', () => {
    const evidence: VerificationEvidence = {
      id: 'ev-1',
      type: 'command_result',
      description: 'Typecheck completed with exit code 0',
      success: true,
      details: 'Found 0 errors',
      checkId: 'check-1',
      timestamp: new Date(),
    };

    expect(evidence.success).toBe(true);
    expect(evidence.type).toBe('command_result');
    expect(evidence.checkId).toBe('check-1');
  });

  it('should represent structured verification failure', () => {
    const failure: VerificationFailure = {
      id: 'fail-1',
      checkId: 'check-1',
      category: 'type_error',
      message: "Property 'userId' does not exist on type 'Request'",
      details: 'src/auth/middleware.ts:42:15',
      recoverable: true,
      file: 'src/auth/middleware.ts',
      line: 42,
      column: 15,
      command: 'pnpm typecheck',
    };

    expect(failure.category).toBe('type_error');
    expect(failure.recoverable).toBe(true);
    expect(failure.file).toBe('src/auth/middleware.ts');
    expect(failure.line).toBe(42);
  });

  it('should represent full VerificationResult with checks, evidence, and failures', () => {
    const now = new Date();
    const result: VerificationResult = {
      id: 'verify-123',
      status: 'passed',
      checks: [
        {
          id: 'check-1',
          type: 'test',
          name: 'Tests',
          status: 'passed',
          exitCode: 0,
        },
      ],
      evidence: [
        {
          id: 'ev-1',
          type: 'test_result',
          description: 'Tests passed',
          success: true,
          timestamp: now,
        },
      ],
      failures: [],
      summary: 'Verification passed: all checks succeeded',
      startedAt: now,
      completedAt: new Date(now.getTime() + 500),
    };

    expect(result.status).toBe('passed');
    expect(result.checks).toHaveLength(1);
    expect(result.evidence).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
  });

  it('should support all valid verification statuses', () => {
    const statuses: VerificationStatus[] = [
      'pending',
      'running',
      'passed',
      'failed',
      'blocked',
      'unable_to_verify',
    ];

    expect(statuses).toHaveLength(6);
  });

  it('should provide default recovery policy limits', () => {
    expect(DEFAULT_RECOVERY_POLICY.maxVerificationAttempts).toBe(3);
    expect(DEFAULT_RECOVERY_POLICY.maxRetries).toBe(2);
    expect(DEFAULT_RECOVERY_POLICY.maxChecks).toBe(10);
    expect(DEFAULT_RECOVERY_POLICY.maxOutputCharacters).toBe(4000);
    expect(DEFAULT_RECOVERY_POLICY.maxVerificationDurationMs).toBeGreaterThan(0);
  });
});
