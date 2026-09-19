import type { VerificationCheck } from './check.js';
import type { VerificationEvidence } from './evidence.js';
import type { VerificationFailure } from './failure.js';

export type VerificationStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'unable_to_verify';

export interface VerificationResult {
  readonly id: string;
  readonly status: VerificationStatus;
  readonly checks: readonly VerificationCheck[];
  readonly evidence: readonly VerificationEvidence[];
  readonly failures: readonly VerificationFailure[];
  readonly summary: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly metadata?: Record<string, unknown>;
}
