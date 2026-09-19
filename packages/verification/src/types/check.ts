export type VerificationCheckType =
  | 'test'
  | 'typecheck'
  | 'lint'
  | 'build'
  | 'command'
  | 'file'
  | 'repository'
  | 'custom';

export type VerificationCheckStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export interface VerificationCheck {
  readonly id: string;
  readonly type: VerificationCheckType;
  readonly name: string;
  readonly description?: string;
  readonly status: VerificationCheckStatus;
  readonly command?: string;
  readonly output?: string;
  readonly exitCode?: number | null;
  readonly durationMs?: number;
  readonly error?: string;
}
