export type EvidenceType =
  | 'command_result'
  | 'file_state'
  | 'test_result'
  | 'tool_result'
  | 'repository_state';

export interface VerificationEvidence {
  readonly id: string;
  readonly type: EvidenceType;
  readonly description: string;
  readonly success: boolean;
  readonly details?: string;
  readonly checkId?: string;
  readonly timestamp: Date;
}
