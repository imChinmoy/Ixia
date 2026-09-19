import { describe, it, expect, vi } from 'vitest';
import { ToolExecutor, ToolRegistry } from '@ixia/tools';
import { registerShellTools } from '@ixia/shell';
import {
  VerificationRunner,
  type VerificationCheck,
} from '@ixia/verification';

describe('VerificationRunner', () => {
  const registry = new ToolRegistry();
  registerShellTools(registry);
  const toolExecutor = new ToolExecutor({ registry });
  const runner = new VerificationRunner({ toolExecutor });

  it('should successfully run a command and record concrete evidence', async () => {
    const check: VerificationCheck = {
      id: 'check-echo',
      type: 'command',
      name: 'Echo check',
      status: 'pending',
      command: 'echo "hello verification"',
    };

    const outcome = await runner.runCheck(check);

    expect(outcome.check.status).toBe('passed');
    expect(outcome.check.exitCode).toBe(0);
    expect(outcome.check.output).toContain('hello verification');
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0]!.success).toBe(true);
    expect(outcome.failures).toHaveLength(0);
  });

  it('should capture failure when command exits with non-zero exit code', async () => {
    const check: VerificationCheck = {
      id: 'check-fail',
      type: 'command',
      name: 'Failing command',
      status: 'pending',
      command: 'exit 42',
    };

    const outcome = await runner.runCheck(check);

    expect(outcome.check.status).toBe('failed');
    expect(outcome.check.exitCode).toBe(42);
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.evidence[0]!.success).toBe(false);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]!.category).toBe('command_failure');
  });

  it('should handle command execution timeout cleanly', async () => {
    const check: VerificationCheck = {
      id: 'check-timeout',
      type: 'command',
      name: 'Slow command',
      status: 'pending',
      command: 'sleep 5',
    };

    const outcome = await runner.runCheck(check, { timeoutMs: 100 });

    expect(outcome.check.status).toBe('failed');
    expect(outcome.check.error).toContain('timed out');
    expect(outcome.evidence[0]!.success).toBe(false);
  });

  it('should cleanly abort when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    const check: VerificationCheck = {
      id: 'check-cancel',
      type: 'command',
      name: 'Cancelled command',
      status: 'pending',
      command: 'echo "cancelled"',
    };

    controller.abort('User cancelled');

    const outcome = await runner.runCheck(check, { signal: controller.signal });

    expect(outcome.check.status).toBe('skipped');
    expect(outcome.check.error).toContain('User cancelled');
  });

  it('should execute checks sequentially and return compiled VerificationResult', async () => {
    const check1: VerificationCheck = {
      id: 'c1',
      type: 'command',
      name: 'Step 1',
      status: 'pending',
      command: 'echo "one"',
    };
    const check2: VerificationCheck = {
      id: 'c2',
      type: 'command',
      name: 'Step 2',
      status: 'pending',
      command: 'echo "two"',
    };

    const onStart = vi.fn();
    const onComplete = vi.fn();

    const result = await runner.runAll([check1, check2], {
      onCheckStart: onStart,
      onCheckComplete: onComplete,
    });

    expect(result.status).toBe('passed');
    expect(result.checks).toHaveLength(2);
    expect(result.evidence).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('should return unable_to_verify when checks array is empty', async () => {
    const result = await runner.runAll([]);
    expect(result.status).toBe('unable_to_verify');
    expect(result.summary).toContain('No verification checks');
  });
});
