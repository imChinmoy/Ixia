export interface RecoveryPolicy {
  readonly maxRetries: number;
  readonly maxVerificationAttempts: number;
  readonly maxChecks: number;
  readonly maxOutputCharacters: number;
  readonly maxVerificationDurationMs: number;
}

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  maxRetries: 2,
  maxVerificationAttempts: 3,
  maxChecks: 10,
  maxOutputCharacters: 4000,
  maxVerificationDurationMs: 60_000,
};
