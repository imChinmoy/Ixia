import { randomUUID } from 'node:crypto';
import type { ToolExecutor } from '@ixia/tools';
import type { ShellExecutionResult } from '@ixia/shell';
import type { VerificationCheck } from './types/check.js';
import type { VerificationEvidence } from './types/evidence.js';
import type { VerificationFailure } from './types/failure.js';
import type { VerificationResult, VerificationStatus } from './types/verification.js';
import { FailureAnalyzer } from './failure-analyzer.js';

export interface VerificationRunnerOptions {
  readonly toolExecutor: ToolExecutor;
  readonly failureAnalyzer?: FailureAnalyzer;
}

export interface RunChecksOptions {
  readonly cwd?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly maxOutputLength?: number;
  readonly onCheckStart?: (check: VerificationCheck) => void;
  readonly onCheckComplete?: (check: VerificationCheck) => void;
}

export class VerificationRunner {
  private readonly toolExecutor: ToolExecutor;
  private readonly failureAnalyzer: FailureAnalyzer;

  constructor(options: VerificationRunnerOptions) {
    this.toolExecutor = options.toolExecutor;
    this.failureAnalyzer = options.failureAnalyzer ?? new FailureAnalyzer();
  }

  /**
   * Executes a single verification check using the existing ToolExecutor and execute_command tool.
   */
  async runCheck(
    check: VerificationCheck,
    options?: RunChecksOptions,
  ): Promise<{
    check: VerificationCheck;
    evidence: VerificationEvidence[];
    failures: VerificationFailure[];
  }> {
    const startedAt = Date.now();
    const updatedCheck: VerificationCheck = {
      ...check,
      status: 'running',
    };

    options?.onCheckStart?.(updatedCheck);

    if (options?.signal?.aborted) {
      const cancelledCheck: VerificationCheck = {
        ...updatedCheck,
        status: 'skipped',
        error: options.signal.reason || 'Verification was cancelled',
      };
      options?.onCheckComplete?.(cancelledCheck);
      return {
        check: cancelledCheck,
        evidence: [],
        failures: [],
      };
    }

    // If check doesn't have a command to run (e.g. placeholder or file-only check)
    if (!check.command) {
      const skippedCheck: VerificationCheck = {
        ...updatedCheck,
        status: 'passed',
        durationMs: Date.now() - startedAt,
      };
      options?.onCheckComplete?.(skippedCheck);
      return {
        check: skippedCheck,
        evidence: [
          {
            id: `ev-${randomUUID()}`,
            type: 'tool_result',
            description: `Check "${check.name}" completed without command`,
            success: true,
            checkId: check.id,
            timestamp: new Date(),
          },
        ],
        failures: [],
      };
    }

    try {
      // Execute command via the existing ToolExecutor
      const toolCallResult = await this.toolExecutor.execute(
        {
          id: `verify-${check.id}`,
          name: 'execute_command',
          arguments: {
            command: check.command,
            cwd: options?.cwd,
            timeoutMs: options?.timeoutMs ?? 30_000,
          },
        },
        {
          cwd: options?.cwd,
          signal: options?.signal,
        },
      );

      const durationMs = Date.now() - startedAt;

      if (!toolCallResult.success) {
        const errorMsg =
          toolCallResult.error instanceof Error
            ? toolCallResult.error.message
            : String(toolCallResult.error ?? 'Command execution failed');

        const failedCheck: VerificationCheck = {
          ...updatedCheck,
          status: 'failed',
          output: errorMsg,
          exitCode: 1,
          durationMs,
          error: errorMsg,
        };

        options?.onCheckComplete?.(failedCheck);

        const failures = this.failureAnalyzer.analyze(failedCheck, errorMsg);
        const evidence: VerificationEvidence = {
          id: `ev-${randomUUID()}`,
          type: 'command_result',
          description: `Check "${check.name}" failed: ${errorMsg}`,
          success: false,
          details: errorMsg,
          checkId: check.id,
          timestamp: new Date(),
        };

        return { check: failedCheck, evidence: [evidence], failures };
      }

      // Shell execution result from tool
      const shellResult = toolCallResult.result as ShellExecutionResult | undefined;
      const stdout = shellResult?.stdout ?? '';
      const stderr = shellResult?.stderr ?? '';
      const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');
      const exitCode = shellResult?.exitCode ?? (toolCallResult.success ? 0 : 1);
      const isSuccess = exitCode === 0 && !shellResult?.timedOut;

      const completedCheck: VerificationCheck = {
        ...updatedCheck,
        status: isSuccess ? 'passed' : 'failed',
        output: combinedOutput,
        exitCode,
        durationMs: shellResult?.durationMs ?? durationMs,
        error: isSuccess
          ? undefined
          : shellResult?.timedOut
            ? 'Command timed out'
            : `Process exited with code ${exitCode}`,
      };

      options?.onCheckComplete?.(completedCheck);

      const evidence: VerificationEvidence = {
        id: `ev-${randomUUID()}`,
        type: 'command_result',
        description: isSuccess
          ? `Check "${check.name}" passed with exit code 0`
          : `Check "${check.name}" failed with exit code ${exitCode}`,
        success: isSuccess,
        details: combinedOutput || undefined,
        checkId: check.id,
        timestamp: new Date(),
      };

      const failures = isSuccess
        ? []
        : this.failureAnalyzer.analyze(completedCheck, combinedOutput);

      return {
        check: completedCheck,
        evidence: [evidence],
        failures,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failedCheck: VerificationCheck = {
        ...updatedCheck,
        status: 'failed',
        output: errorMsg,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        error: errorMsg,
      };

      options?.onCheckComplete?.(failedCheck);

      const failures = this.failureAnalyzer.analyze(failedCheck, errorMsg);
      const evidence: VerificationEvidence = {
        id: `ev-${randomUUID()}`,
        type: 'command_result',
        description: `Check "${check.name}" failed with unexpected error`,
        success: false,
        details: errorMsg,
        checkId: check.id,
        timestamp: new Date(),
      };

      return {
        check: failedCheck,
        evidence: [evidence],
        failures,
      };
    }
  }

  /**
   * Runs an array of verification checks sequentially and compiles the final VerificationResult.
   */
  async runAll(
    checks: readonly VerificationCheck[],
    options?: RunChecksOptions,
  ): Promise<VerificationResult> {
    const startedAt = new Date();
    const resultId = `verify-${randomUUID()}`;

    if (checks.length === 0) {
      return {
        id: resultId,
        status: 'unable_to_verify',
        checks: [],
        evidence: [],
        failures: [],
        summary: 'No verification checks could be discovered or executed for this task.',
        startedAt,
        completedAt: new Date(),
      };
    }

    const executedChecks: VerificationCheck[] = [];
    const allEvidence: VerificationEvidence[] = [];
    const allFailures: VerificationFailure[] = [];

    for (const check of checks) {
      if (options?.signal?.aborted) {
        executedChecks.push({
          ...check,
          status: 'skipped',
          error: options.signal.reason || 'Verification cancelled',
        });
        continue;
      }

      const outcome = await this.runCheck(check, options);
      executedChecks.push(outcome.check);
      allEvidence.push(...outcome.evidence);
      allFailures.push(...outcome.failures);

      // Stop on critical environment failure
      if (outcome.failures.some((f) => f.category === 'environment_failure' && !f.recoverable)) {
        break;
      }
    }

    const completedAt = new Date();
    const hasFailures = allFailures.length > 0;
    const hasBlocked = allFailures.some(
      (f) => f.category === 'environment_failure' && !f.recoverable,
    );

    let status: VerificationStatus = 'passed';
    if (options?.signal?.aborted) {
      status = 'blocked';
    } else if (hasBlocked) {
      status = 'blocked';
    } else if (hasFailures) {
      status = 'failed';
    }

    let summary = '';
    if (status === 'passed') {
      summary = `Verification passed: all ${executedChecks.length} checks succeeded with concrete evidence.`;
    } else if (status === 'blocked') {
      summary = `Verification blocked by environment: ${allFailures[0]?.message || 'Operation cancelled'}`;
    } else {
      const failCount = executedChecks.filter((c) => c.status === 'failed').length;
      const primaryMsg = allFailures[0]?.message || 'Checks failed';
      summary = `Verification failed: ${failCount}/${executedChecks.length} checks failed. (${primaryMsg})`;
    }

    return {
      id: resultId,
      status,
      checks: executedChecks,
      evidence: allEvidence,
      failures: allFailures,
      summary,
      startedAt,
      completedAt,
    };
  }
}
