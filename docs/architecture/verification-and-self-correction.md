# Verification & Self-Correction Architecture

The **Verification & Self-Correction** subsystem (`@ixia/verification`) equips Ixia with concrete evidence-based verification and automated self-correction capabilities. It ensures that Ixia **does not assume successful tool execution implies successful task completion**.

```text
User
 ↓
Understand
 ↓
Plan
 ↓
Execute
 ↓
Verify
 ↓
 ┌───────────────┐
 │               │
PASS            FAIL
 │               │
 ↓               ↓
Continue      Diagnose (FailureAnalyzer)
                 ↓
              Correct (Existing Agent Runtime)
                 ↓
              Verify again
                 ↓
              Continue / Exhausted
```

---

## 1. Architectural Purpose & Boundaries

A fundamental principle in Ixia is the separation of responsibilities:

- **Planner (`@ixia/planner`)**: What work should be done?
- **Agent Runtime (`@ixia/agent`)**: What should I execute next?
- **Tool System (`@ixia/tools`, `@ixia/shell`)**: How do I execute a tool safely?
- **Repository Context (`@ixia/context`)**: What parts of the repository are relevant?
- **Verification System (`@ixia/verification`)**: Did the work actually succeed based on concrete evidence?
- **Self-Correction (`@ixia/agent`)**: How does the existing agent runtime repair failed work within bounded retry limits?

```text
                         ┌──────────────┐
                         │     User     │
                         └──────┬───────┘
                                ↓
                         ┌──────────────┐
                         │  Ixia CLI    │
                         └──────┬───────┘
                                ↓
                       ┌──────────────────┐
                       │  Agent Runtime   │
                       └──────┬───────────┘
                              │
              ┌───────────────┼────────────────┐
              ↓               ↓                ↓
          Context          Planner        Conversation
              │               │                │
              └───────────────┼────────────────┘
                              ↓
                         LLM Provider
                              │
                              ↓
                         Tool System
                              │
                              ↓
                         Tool Executor
                              │
                  ┌───────────┴───────────┐
                  ↓                       ↓
             Filesystem                Shell
                  │                       │
                  └───────────┬───────────┘
                              ↓
                         Tool Results
                              │
                              ↓
                        Verification
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
                  PASS                FAIL
                    │                   │
                    ↓                   ↓
               Next Step          Failure Analysis
                                        │
                                        ↓
                                  Self-Correction
                                        │
                                        ↓
                                  Agent Runtime
                                        │
                                        └──────→ Execute
```

Crucially:
- **No duplicate Agent Loop**: Self-correction uses the existing `AgentLoop` in `@ixia/agent`.
- **No duplicate Shell Execution**: Verification commands route directly through `ToolExecutor.execute('execute_command')`, inheriting timeouts, cancellation, working directory controls, and workspace boundaries.
- **No Fabricated Verification**: The LLM does not dictate verification success. Real command exit codes, execution metrics, and file state are authoritative.

---

## 2. Verification Model

The verification subsystem operates on structured, immutable results:

```typescript
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
```

### Honest Status Distinction
Ixia distinguishes between:
- **`passed` (`✓ Verified`)**: All required checks ran and passed with exit code 0 and concrete evidence.
- **`failed` (`✗ Verification failed`)**: At least one check failed (e.g. non-zero exit code, test assertion error, type error).
- **`blocked` (`! Blocked`)**: Verification was blocked due to external environment or unrecoverable issues (e.g. network timeout, permission denied).
- **`unable_to_verify` (`⚠ Unable to verify`)**: No verification commands could be discovered for the repository or task. Ixia never falsely claims success when verification was unavailable.

---

## 3. Verification Checks & Automatic Discovery

Individual checks represent atomic verification steps:

```typescript
export type VerificationCheckType =
  | 'test'
  | 'typecheck'
  | 'lint'
  | 'build'
  | 'command'
  | 'file'
  | 'repository'
  | 'custom';

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
```

### Automatic Verification Discovery (`VerificationPolicy`)
`VerificationPolicy.discoverChecks(cwd)` inspects repository manifests and package configuration without inventing fictitious commands:
- **Node.js / TypeScript**: Reads `package.json` scripts (`typecheck`, `test`, `lint`, `build`) and detects the active package manager (`pnpm`, `yarn`, `npm`).
- **Python**: Detects `pyproject.toml`, `pytest.ini`, `setup.py` (`pytest`, `mypy .`, `ruff check .`).
- **Rust**: Detects `Cargo.toml` (`cargo test`, `cargo check`).
- **Go**: Detects `go.mod` (`go test ./...`, `go vet ./...`).
- **Dart / Flutter**: Detects `pubspec.yaml` (`dart test`, `dart analyze`).

### Targeted Verification
`VerificationPolicy.selectChecks()` matches checks proportionally:
- **Informational steps** (`inspect`, `explore`, `read`, `analyze`): Bypasses expensive checks (`checks: []`).
- **Test-related steps**: Selects automated test suite checks.
- **Type-related steps**: Selects compiler typechecks.
- **Code implementation / refactoring**: Selects compiler typechecks and relevant tests.
- **Final task verification**: Runs the primary suites across the project (`typecheck`, `test`, `build`).

---

## 4. Evidence-Based Verification

Verification requires concrete evidence:

```typescript
export interface VerificationEvidence {
  readonly id: string;
  readonly type: 'command_result' | 'file_state' | 'test_result' | 'tool_result' | 'repository_state';
  readonly description: string;
  readonly success: boolean;
  readonly details?: string;
  readonly checkId?: string;
  readonly timestamp: Date;
}
```

> **Rule: No evidence → no verified success.**

Tool invocation success (e.g. `execute_command("npm test")` successfully returning output) is distinguished from verification success. The verifier inspects exit code, output contents, timeouts, and signals.

---

## 5. Failure Model & Failure Analysis

When a verification check fails, raw command output is transformed into structured diagnostic information by `FailureAnalyzer`:

```typescript
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
```

### Categorization & Extraction
1. **Type errors**: Extracts file, line, column, and compiler reason (e.g. `src/auth.ts:42:15 - Property 'userId' does not exist on type 'Request'`). Marked `recoverable: true`.
2. **Test failures**: Extracts failing test name, test file, and assertion diffs. Marked `recoverable: true`.
3. **Lint errors**: Extracts file, line, rule name, and lint description. Marked `recoverable: true`.
4. **Build failures**: Extracts compilation errors or missing module specifiers. Marked `recoverable: true`.
5. **Environment failures**: Detects permissions (`EACCES`), network timeouts (`ENOTFOUND`, `ECONNREFUSED`), missing binaries, or missing environment variables. Marked `recoverable: false` (blocks execution instead of blindly modifying code).
6. **Command / Unknown failures**: Captures non-zero exit codes without hallucinating causes.

---

## 6. Self-Correction & Bounded Recovery

When verification fails, `AgentRuntime` coordinates recovery using the existing agent loop:

```text
Step Execution
     ↓
Step Verification
     ↓
    FAIL
     ↓
Format Failure Context (verifier.formatFailureContext)
     ↓
Add to ConversationManager (role: 'user')
     ↓
AgentLoop Turn (Model analyzes error, reasons, and executes corrective tools)
     ↓
Re-Verify Step Checks
     ↓
 ┌───────────────┐
 │               │
PASS            FAIL
 │               │
 ↓               ↓
Complete      Retry (if attempts < maxVerificationAttempts)
                 ↓
              Exhausted (if attempts >= maxVerificationAttempts)
                 ↓
              Fail Step & Halt
```

### Compact Failure Context
The failure context provided to the model is compact and structured, avoiding dumping raw, unlimited terminal streams into the LLM context:

```text
VERIFICATION FAILURE

Task:
Add authentication middleware.

Check:
TypeScript typecheck

Status:
FAILED

Exit code:
2

Output:
src/auth/middleware.ts:42:15 - error TS2339: Property 'userId' does not exist on type 'Request'.

Failure Summary:
- [type_error] Property 'userId' does not exist on type 'Request'
  Location: src/auth/middleware.ts:42:15

Required action:
Investigate the failure and correct the implementation. Do not assume the work succeeded until all checks pass.
```

### Bounded Limits (`RecoveryPolicy`)
Self-correction is strictly bounded to prevent infinite execution cycles:

```typescript
export interface RecoveryPolicy {
  readonly maxRetries: number;                // Default: 2
  readonly maxVerificationAttempts: number;   // Default: 3
  readonly maxChecks: number;                  // Default: 10
  readonly maxOutputCharacters: number;        // Default: 4000
  readonly maxVerificationDurationMs: number;  // Default: 60,000ms
}
```

---

## 7. Plan Integration & Verification Events

### Step & Final Verification Flow
1. **Step Execution**: Agent completes tool execution turns for a plan step.
2. **Step Verification**: `verifier.selectChecks({ step })` selects targeted checks.
   - If no checks needed: step completes.
   - If checks pass: `verification_passed` event, step completes, advances to next step.
   - If checks fail: `verification_failed`, enters self-correction loop up to `maxVerificationAttempts`.
   - If recovery succeeds: `recovery_completed`, step completes.
   - If recovery exhausted: `recovery_exhausted`, `step_failed`, plan halts.
3. **Final Task Verification**: When all steps are completed, `verifier.verifyFinal(plan)` runs primary project checks to ensure the overall repository state satisfies the goal.

### Event Architecture
Verification emits structured events consumed by both One-Shot mode and Interactive UI:

| Event Type | Payload | Meaning |
|---|---|---|
| `verification_started` | `target: 'step' \| 'final'`, `checks` | Verification phase initiated |
| `verification_check_started` | `check` | Check execution started |
| `verification_check_completed` | `check`, `status`, `durationMs` | Check execution finished |
| `verification_passed` | `target`, `result` | Verification succeeded |
| `verification_failed` | `target`, `result`, `recoverable` | Verification failed |
| `recovery_started` | `stepId`, `attempt`, `maxAttempts`, `failure` | Self-correction attempt begun |
| `recovery_attempted` | `stepId`, `attempt`, `maxAttempts` | Corrective tool calls finished, re-verifying |
| `recovery_completed` | `stepId`, `attempt`, `result` | Correction succeeded on verification |
| `recovery_exhausted` | `stepId`, `totalAttempts`, `failures` | Retry limit reached without success |

---

## 8. CLI & Terminal UI

### One-Shot Mode (`ixia "<prompt>"`)
Real-time streaming to stdout:

```text
▶ Add authentication middleware
→ execute_command {"command":"pnpm test"}
✓ execute_command

  Checking... (2 checks)
  ✓ TypeScript typecheck (520ms)
  ✗ Test suite (410ms)
    FAIL tests/auth.test.ts
    AssertionError: expected false to be true

✗ Verification failed
  ✗ [test_failure] expected false to be true (tests/auth.test.ts:35)

↻ Attempting correction (attempt 1/3)...
→ execute_command {"command":"pnpm test"}
✓ execute_command

  Checking again...
  ✓ TypeScript typecheck (510ms)
  ✓ Test suite (390ms)

✓ Correction applied
✓ Step completed
```

### Interactive UI (`InteractiveScreen.tsx`)
- Displays live check progress (`verify: TypeScript typecheck`, `✓`, `✗`).
- Displays self-correction indicators during recovery loops.
- Displays honest failure notifications when verification is exhausted.

---

## 9. Cancellation & Resource Safety

- Long-running verification commands respect `AbortSignal` (Ctrl+C).
- Cancellation cleanly skips remaining checks, marks the plan as `cancelled`, and returns the agent state to `idle`.
- No orphan processes are left running behind.

---

## 10. Out of Scope for Phase 10

Phase 10 deliberately preserves architectural boundaries and does **not** implement:
- Dedicated file editing tools (deferred to subsequent phases).
- AST analysis, LSP integration, or semantic code intelligence.
- Mutation testing, fuzzing, formal verification, or CI/CD pipelines.
- Distributed test runners or remote telemetry.
