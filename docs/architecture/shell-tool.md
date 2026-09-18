# Terminal & Shell Tool Architecture

The **Terminal / Shell Tool** layer (`@sora/shell`) provides Sora with asynchronous, safe shell command execution capabilities. It bridges the generic Tool System from Phase 4 and workspace containment from Phase 5 with OS process execution.

```text
                    ┌──────────────────┐
                    │    Sora CLI/UI   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Conversation   │
                    │      Engine      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   LLM Provider   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Tool System    │
                    │  (ToolRegistry / │
                    │   ToolExecutor)  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ execute_command  │
                    │      Tool        │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   ShellService   │
                    └────────┬─────────┘
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
      ┌──────────────────┐        ┌──────────────────┐
      │   PathService    │        │ ProcessExecutor  │
      │ (Boundary Check) │        │ (spawn/timeout/  │
      └──────────────────┘        │  buffering/kill) │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   Node Process   │
                                  │  (child_process) │
                                  └──────────────────┘
```

---

## 1. Why the Shell Tool Exists

A coding assistant cannot merely read files; it needs the ability to execute development workflow commands such as:

- Running unit and integration tests (`npm test`, `vitest run`, `cargo test`, `pytest`).
- Building and typechecking projects (`pnpm build`, `tsc --noEmit`).
- Inspecting version control state (`git status`, `git diff`).
- Listing system information (`pwd`, `node --version`, `uname -a`).

The Shell Tool gives Sora the infrastructure to execute shell commands within the project repository under strict operational bounds.

Crucially:
> **Phase 6 implements the tool capability, not an autonomous agent loop.**
> Autonomous execution and loop iterations (`LLM -> Shell -> LLM -> Shell`) belong to Phase 7.

---

## 2. Shell Architecture & Separation of Concerns

The architecture is layered into clean, decoupled components:

```text
Tool Layer (@sora/shell/tools)
  └── ExecuteCommandTool
         │
         ▼
Service Layer (@sora/shell/services)
  ├── ShellService (validates inputs & coordinates workspace containment)
  ├── ProcessExecutor (manages child_process spawn, timeouts, buffers, and signals)
  └── PathService (@sora/filesystem) (enforces workspace directory boundaries)
         │
         ▼
Node.js Runtime (node:child_process, node:process)
```

1. **`ExecuteCommandTool`**: Implements the provider-agnostic `Tool<ExecuteCommandInput, ShellExecutionResult>` interface. It defines the JSON schema for LLM function calling and connects incoming tool calls to `ShellService`.
2. **`ShellService`**: Validates the command string and delegates path resolution to `PathService` from `@sora/filesystem` to prevent working-directory escape attacks.
3. **`ProcessExecutor`**: Low-level process runner that handles asynchronous execution via `child_process.spawn`, streams stdout/stderr with memory-bounded buffers, enforces timeouts, tracks execution time monotonically, and handles cancellation via `AbortSignal`.

---

## 3. Tool Specification: `execute_command`

The shell tool is registered into Sora's `ToolRegistry` under the name `execute_command`:

### Input Schema (`ExecuteCommandInput`)

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `command` | `string` | **Yes** | The shell command to execute. |
| `cwd` | `string` | No | Working directory relative to workspace root (defaults to `.`). |
| `timeoutMs` | `number` | No | Timeout in milliseconds (defaults to 30,000 ms). |

### Output Schema (`ShellExecutionResult`)

| Property | Type | Description |
| :--- | :--- | :--- |
| `command` | `string` | The command that was executed. |
| `cwd` | `string` | The absolute working directory where the process ran. |
| `stdout` | `string` | Captured standard output stream. |
| `stderr` | `string` | Captured standard error stream. |
| `exitCode` | `number \| null` | Process exit status code (0 = success, non-zero = failure). |
| `signal` | `string \| undefined` | Termination signal if terminated by OS or signal (e.g. `SIGTERM`, `SIGKILL`). |
| `durationMs` | `number` | Monotonic execution time in milliseconds. |
| `timedOut` | `boolean` | True if the command exceeded its timeout limit. |
| `truncated` | `boolean` | True if stdout or stderr exceeded maximum memory buffers. |

---

## 4. Execution Lifecycle & Safeguards

### Asynchronous Spawning
Commands are spawned non-blockingly using `node:child_process.spawn`. The shell binary is automatically selected based on the operating platform:
- **POSIX (Linux / macOS)**: `process.env.SHELL || '/bin/sh'` with `['-c', command]`
- **Windows**: `process.env.COMSPEC || 'cmd.exe'` with `['/d', '/s', '/c', command]`

### Monotonic Duration Timing
Execution duration is measured using high-resolution monotonic time:
```typescript
const startTime = process.hrtime.bigint();
// ... on process close:
const durationMs = Number((process.hrtime.bigint() - startTime) / 1_000_000n);
```
This guarantees accurate metrics unaffected by system clock adjustments.

### Bounded Output Buffering
Runaway processes printing infinite text (e.g., `yes` or infinite test loops) could exhaust system memory. To protect the host environment:
- `DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024` (1 MB) for stdout and stderr independently.
- Buffers are collected using byte-length tracking.
- If output exceeds the limit:
  1. Output is sliced to the maximum byte limit.
  2. `truncated` is marked `true`.
  3. A `SIGTERM` signal is immediately dispatched to terminate the runaway process.

### Timeout Handling & Process Termination
- Default timeout is 30 seconds (`DEFAULT_SHELL_TIMEOUT_MS = 30_000`), configurable per-execution via `input.timeoutMs` or globally via `SORA_SHELL_TIMEOUT_MS`.
- When a timeout occurs:
  1. `timedOut` is marked `true`.
  2. `SIGTERM` is sent to the child process.
  3. A fallback unref'd timer is scheduled to send `SIGKILL` after 1,000 ms if the process fails to exit cleanly.

### Cancellation Support (`AbortSignal`)
`ExecuteCommandTool` receives an optional `AbortSignal` via `ToolExecutionContext.signal`. If an abort event fires:
- The running process is immediately sent `SIGTERM` (followed by fallback `SIGKILL`).
- The execution Promise rejects with `CommandAbortedError`.
- Cleanups ensure that timers and event listeners are removed.

---

## 5. Exit Code Semantics: Observation vs System Error

A critical architectural distinction is made between:

1. **Process Execution Failure (`exitCode !== 0`)**:
   - A command like `npm test` or `tsc` exiting with code `1` or `2` is a normal event in software development.
   - The LLM *needs* to inspect the compiler errors, failed assertions, and stderr to diagnose issues.
   - Therefore, `execute_command` resolves successfully at the `ToolExecutionResult` level (`success: true`), returning the structured `ShellExecutionResult` containing `exitCode: 1`, `stdout`, and `stderr`.

2. **Tool System Failure (Exceptions)**:
   - When the tool itself cannot execute (e.g. invalid arguments, missing shell binary, workspace containment violation), the tool rejects with an instance of `ToolError`.
   - `ToolExecutor` wraps this as `ToolExecutionResult` with `success: false` and a structured `error`.

---

## 6. Workspace Containment & Security Model

### Safe Working Directory Enforcement
`ShellService` integrates directly with Phase 5's `PathService`. When a caller specifies a relative `cwd`:
```typescript
const resolvedCwd = await this.pathService.resolveSafePath(targetCwd, workspaceRoot);
```
If `cwd` attempts path traversal outside the workspace (e.g. `../../../../etc` or symlinks pointing outside the workspace), `PathService` immediately throws `WorkspaceViolationError`. The command is never spawned.

### No Naive String Blacklists
Arbitrary command execution is an intentional capability of a developer CLI. Naive string-matching blacklists (e.g., blocking `rm` or `git`) are fragile, easily bypassed via bash tricks (`/bin/r\m`, base64 decoding, env variables), and prevent legitimate developer workflows (`pnpm build && git status`).

Instead, security is handled systematically:
- Workspace boundary containment prevents directory traversal.
- Memory bounds protect system RAM from runaway commands.
- Timeouts protect against hanging commands.
- User permission gates and confirmation policies are reserved for Phase 12 (Policy & Permissions), where security belongs at the execution interceptor level.

---

## 7. Structured Error Hierarchy

All shell errors extend `ToolError` from `@sora/tools`:

```text
SoraError (@sora/core)
   └── ToolError (@sora/tools)
         └── ShellError (@sora/shell)
               ├── CommandStartError (failed to spawn shell or process)
               ├── CommandTimeoutError (command exceeded timeout limit)
               └── CommandAbortedError (command was cancelled via AbortSignal)
```

---

## 8. Why File Modification & Agent Loop Are Excluded

- **File Modification (Phase 11)**: While shell commands *can* manipulate files via standard Unix tools, dedicated safe editing tools (`edit_file`, `write_file`) with diffing, chunk replacement, and atomic rollbacks will be implemented in future phases.
- **Autonomous Agent Loop (Phase 7)**: Executing a shell command on request is a tool capability. Autonomously deciding to run a test, inspecting stderr, and iteratively rewriting code in a feedback loop requires the Agent Loop (Phase 7), which builds upon this shell tool foundation.
