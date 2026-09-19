export type FailureCategory =
  | 'test_failure'
  | 'type_error'
  | 'lint_error'
  | 'build_failure'
  | 'command_failure'
  | 'missing_file'
  | 'unexpected_state'
  | 'environment_failure'
  | 'unknown';

export interface VerificationFailure {
  readonly id: string;
  readonly checkId?: string;
  readonly category: FailureCategory;
  readonly message: string;
  readonly details?: string;
  readonly recoverable: boolean;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly command?: string;
}
