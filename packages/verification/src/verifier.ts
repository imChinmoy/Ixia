import type { ToolExecutor } from '@ixia/tools';
import type { Plan, PlanStep } from '@ixia/planner';
import type { VerificationCheck } from './types/check.js';
import type { VerificationFailure } from './types/failure.js';
import type { VerificationResult } from './types/verification.js';
import { FailureAnalyzer } from './failure-analyzer.js';
import {
  VerificationPolicy,
  type VerificationSelectionContext,
} from './verification-policy.js';
import {
  VerificationRunner,
  type RunChecksOptions,
} from './verification-runner.js';
import {
  DEFAULT_RECOVERY_POLICY,
  type RecoveryPolicy,
} from './recovery-policy.js';

export interface VerifierServiceOptions {
  readonly toolExecutor: ToolExecutor;
  readonly policy?: VerificationPolicy;
  readonly runner?: VerificationRunner;
  readonly analyzer?: FailureAnalyzer;
  readonly recoveryPolicy?: Partial<RecoveryPolicy>;
}

export class VerifierService {
  private readonly toolExecutor: ToolExecutor;
  private readonly policy: VerificationPolicy;
  private readonly runner: VerificationRunner;
  private readonly analyzer: FailureAnalyzer;
  private readonly recoveryPolicy: RecoveryPolicy;

  constructor(options: VerifierServiceOptions) {
    this.toolExecutor = options.toolExecutor;
    this.policy = options.policy ?? new VerificationPolicy();
    this.analyzer =
      options.analyzer ??
      new FailureAnalyzer({
        maxOutputLength: options.recoveryPolicy?.maxOutputCharacters,
      });
    this.runner =
      options.runner ??
      new VerificationRunner({
        toolExecutor: this.toolExecutor,
        failureAnalyzer: this.analyzer,
      });
    this.recoveryPolicy = {
      ...DEFAULT_RECOVERY_POLICY,
      ...(options.recoveryPolicy ?? {}),
    };
  }

  getRecoveryPolicy(): RecoveryPolicy {
    return { ...this.recoveryPolicy };
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  getPolicy(): VerificationPolicy {
    return this.policy;
  }

  getRunner(): VerificationRunner {
    return this.runner;
  }

  getAnalyzer(): FailureAnalyzer {
    return this.analyzer;
  }

  /**
   * Discovers available verification checks in the workspace.
   */
  async discoverChecks(cwd?: string): Promise<VerificationCheck[]> {
    return this.policy.discoverChecks(cwd);
  }

  /**
   * Selects targeted verification checks proportional to the given context.
   */
  async selectChecks(
    context: VerificationSelectionContext,
  ): Promise<VerificationCheck[]> {
    return this.policy.selectChecks(context);
  }

  /**
   * Executes verification checks and returns structured VerificationResult.
   */
  async verify(
    checks: readonly VerificationCheck[],
    options?: RunChecksOptions,
  ): Promise<VerificationResult> {
    return this.runner.runAll(checks, {
      ...options,
      maxOutputLength: this.recoveryPolicy.maxOutputCharacters,
    });
  }

  /**
   * Performs targeted verification for a single plan step.
   */
  async verifyStep(
    step: PlanStep,
    plan: Plan,
    options?: RunChecksOptions,
  ): Promise<VerificationResult> {
    const checks = await this.selectChecks({
      task: step.title,
      step,
      plan,
      cwd: options?.cwd,
    });

    if (checks.length === 0) {
      return {
        id: `verify-step-${step.id}`,
        status: 'passed',
        checks: [],
        evidence: [],
        failures: [],
        summary: `Step "${step.title}" completed (no verification checks required).`,
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    return this.verify(checks, options);
  }

  /**
   * Performs final task verification across the entire completed plan.
   */
  async verifyFinal(
    plan: Plan,
    options?: RunChecksOptions,
  ): Promise<VerificationResult> {
    const checks = await this.selectChecks({
      task: plan.goal,
      plan,
      cwd: options?.cwd,
      isFinal: true,
    });

    return this.verify(checks, options);
  }

  /**
   * Formats a structured verification failure into a compact prompt context
   * for the LLM to understand and perform self-correction.
   */
  formatFailureContext(
    failures: readonly VerificationFailure[],
    task: string,
    check?: VerificationCheck,
  ): string {
    const primaryFailure = failures[0];
    const checkName = check?.name ?? primaryFailure?.category ?? 'Verification';
    const exitCode = check?.exitCode !== undefined && check?.exitCode !== null ? check.exitCode : 'non-zero';

    let output = (check?.output ?? primaryFailure?.details ?? primaryFailure?.message ?? '').trim();
    if (output.length > this.recoveryPolicy.maxOutputCharacters) {
      output = `${output.slice(0, this.recoveryPolicy.maxOutputCharacters)}\n... [output truncated]`;
    }

    const failureDetails = failures
      .map((f) => {
        let line = `- [${f.category}] ${f.message}`;
        if (f.file) {
          line += `\n  Location: ${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}`;
        }
        return line;
      })
      .join('\n');

    return `VERIFICATION FAILURE

Task:
${task}

Check:
${checkName}

Status:
FAILED

Exit code:
${exitCode}

Output:
${output}

Failure Summary:
${failureDetails}

Required action:
Investigate the failure and correct the implementation. Do not assume the work succeeded until all checks pass.`;
  }
}
