# Agent Loop & Runtime Architecture

The **Agent Loop** (`@ixia/agent`) is the core execution engine of Ixia. It elevates Ixia from a conversational LLM assistant into an **autonomous developer coding agent** capable of inspecting projects, reading files, executing shell commands, observing results, self-correcting on errors, and completing multi-step developer workflows.

```text
                               ┌──────────────────┐
                               │     User / UI    │
                               └────────┬─────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │   AgentRuntime   │ (State machine, concurrency lock,
                               └────────┬─────────┘  lifecycle event dispatching)
                                        │
                                        ▼
                               ┌──────────────────┐
                               │    AgentLoop     │ (Iteration limiter, budget guard,
                               └────────┬─────────┘  multi-turn coordination)
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │        ConversationManager        │
                      │  (Messages history + System prompt)│
                      └─────────────────┬─────────────────┘
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │            LLMProvider            │
                      │    (GroqProvider / Streaming API) │
                      └─────────────────┬─────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [Final Text Delta]             [Tool Call(s)]
                         │                             │
                         ▼                             ▼
                 ┌───────────────┐           ┌───────────────────┐
                 │agent_completed│           │  ToolCallHandler  │
                 └───────────────┘           └─────────┬─────────┘
                                                       │
                                                       ▼
                                             ┌───────────────────┐
                                             │   ToolExecutor    │
                                             └─────────┬─────────┘
                                                       │
                                        ┌──────────────┴──────────────┐
                                        ▼                             ▼
                               ┌─────────────────┐           ┌─────────────────┐
                               │ Filesystem Tools│           │   Shell Tools   │
                               │ (read_file,     │           │(execute_command)│
                               │  search_files)  │           └─────────────────┘
                               └────────┬────────┘                    │
                                        └──────────────┬──────────────┘
                                                       ▼
                                             ┌───────────────────┐
                                             │Tool Result Message│
                                             │ (role: 'tool')    │
                                             └─────────┬─────────┘
                                                       │
                                      (Feed back to ConversationManager)
                                                       │
                                                       ▼
                                              (Next Loop Iteration)
```

---

## 1. Core Principles

1. **Autonomous Multi-Turn Execution**: Ixia does not require the user to manually trigger each tool step. If the user asks *"Inspect package.json and run the test suite"*, the loop iteratively reads `package.json`, analyzes dependencies, executes the test command, observes test output, and reports findings.
2. **Provider Independence**: `@ixia/agent` has no hard dependency on Groq or OpenAI SDKs. It coordinates purely via the provider-agnostic interfaces in `@ixia/core` and `@ixia/tools`.
3. **Graceful Tool Failure Recovery**: A failing tool (e.g. invalid arguments, missing file, or command with non-zero exit code) does not crash the agent. The failure is serialized and delivered back to the model as a `role: 'tool'` message. The LLM can observe the failure, analyze the output, attempt an alternative strategy, or explain the issue to the developer.
4. **Strict Safety Limits**: Autonomous agents must not loop infinitely or exhaust token budgets. Strict, configurable `maxIterations` (default: 10) and `maxToolCalls` (default: 25) prevent infinite execution cycles.
5. **Responsive Cancellation**: Long-running tool executions (e.g., test suites, builds) can be cleanly cancelled at any time via an `AbortSignal` (Ctrl+C in the terminal), halting both the running tool and the agent loop.
6. **Separation of Concerns**: The agent coordinates, the tools execute, and the UI displays.

---

## 2. Package Architecture (`@ixia/agent`)

The `@ixia/agent` package is structured into discrete, single-responsibility modules:

```text
packages/agent/src/
├── types/
│   ├── agent.ts            # AgentState, AgentConfig, AgentEvent, AgentRunResult
│   └── index.ts
├── errors/
│   ├── agent.errors.ts     # AgentRuntimeError, LimitErrors, CancelledError, BusyError
│   └── index.ts
├── loop/
│   ├── tool-call-handler.ts # Isolated tool call dispatch & Message conversion
│   ├── agent-loop.ts       # Iterative multi-turn loop implementation
│   └── index.ts
├── runtime/
│   ├── agent.runtime.ts    # High-level coordinator, lock manager, stream facade
│   └── index.ts
└── index.ts
```

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `AgentRuntime` | Coordinates `ConversationManager`, `ToolRegistry`, and `ToolExecutor`. Enforces concurrency lock. Exposes streaming (`runStream`) and promise-based (`run`) APIs. Manages the lifecycle state machine. |
| `AgentLoop` | Executes the iterative cycle: constructs provider payloads, streams model deltas, detects tool calls, dispatches tool execution, handles limits, and feeds results back into conversation history. |
| `ToolCallHandler` | Executes individual tool calls via `ToolExecutor.execute()`, sanitizes outputs, and converts success results or error details into standardized `role: 'tool'` messages. |
| `AgentErrors` | Typed error classes including `AgentIterationLimitError`, `AgentToolCallLimitError`, `AgentCancelledError`, and `AgentBusyError`. |

---

## 3. Agent Lifecycle & State Machine

The agent maintains a strict state machine during operation:

```text
               ┌───────────┐
               │   idle    │◄────────────────────────┐
               └─────┬─────┘                         │
                     │ runStream()                   │
                     ▼                               │
               ┌───────────┐                         │
        ┌─────►│  running  │                         │
        │      └─────┬─────┘                         │
        │            │                               │
        │            │ tool_call detected            │
        │            ▼                               │
        │      ┌───────────────────┐                 │
        └──────┤ waiting_for_tool  │                 │
 tool completed└─────┬─────────────┘                 │
                     │                               │
       ┌─────────────┼──────────────┐                │
       │ final text  │ error        │ cancelled      │
       ▼             ▼              ▼                │
 ┌───────────┐ ┌───────────┐ ┌─────────────┐         │
 │ completed │ │  failed   │ │  cancelled  │         │
 └─────┬─────┘ └─────┬─────┘ └──────┬──────┘         │
       │             │              │                │
       └─────────────┴──────────────┴────────────────┘
                   (Return to idle on finish)
```

- **`idle`**: Agent is awaiting user input.
- **`running`**: LLM generation or stream processing is in progress.
- **`waiting_for_tool`**: A tool call has been dispatched to `ToolExecutor` and the agent is awaiting execution results.
- **`completed`**: Execution finished normally with a final answer.
- **`failed`**: Execution aborted due to an unrecoverable runtime or provider error.
- **`cancelled`**: Execution was interrupted by user cancellation (`AbortSignal` or Ctrl+C).

---

## 4. Message Model Extension (`role: 'tool'`)

To support tool feedback into the conversation history, the core `@ixia/core` message model was extended:

```typescript
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolCallId?: string;
  readonly toolName?: string;
}
```

### LLM Serialization (`toGroqMessages`)

Provider adapters map these messages into OpenAI/Groq compatible chat completion structures:

- **Assistant message with tool calls**:
  ```json
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [
      {
        "id": "call_123",
        "type": "function",
        "function": {
          "name": "read_file",
          "arguments": "{\"path\":\"package.json\"}"
        }
      }
    ]
  }
  ```
- **Tool execution response**:
  ```json
  {
    "role": "tool",
    "tool_call_id": "call_123",
    "content": "{\n  \"name\": \"@ixia/core\",\n  \"version\": \"0.2.0\"\n}"
  }
  ```

---

## 5. Loop Mechanics & Turn Execution

Each turn within `AgentLoop.run()` follows these structured phases:

1. **Cancellation Check**: Verifies if `options.signal?.aborted` was triggered.
2. **Iteration Budget Check**: Ensures `iteration < maxIterations` (default 10). If exceeded, throws `AgentIterationLimitError`.
3. **Payload Construction**: Prepend system prompt to conversation messages from `ConversationManager.getMessages()`.
4. **Tool Schema Extraction**: Extract JSON schema definitions from `ToolRegistry.getDefinitions()`.
5. **Model Invocation**: Call `provider.stream(messages, { tools, signal, ... })`.
   - Forward `text_delta` events as `llm_text_delta`.
   - Collect any emitted `tool_call` events.
6. **Decision Branch**:
   - **Branch A (Final Response)**: If zero tool calls were made, model produced a final answer. Add assistant message to conversation history, emit `agent_completed`, and exit loop.
   - **Branch B (Tool Invocation)**:
     - Check `totalToolCalls + toolCalls.length <= maxToolCalls`.
     - Record assistant message with `toolCalls` in conversation history.
     - For each tool call, emit `tool_call_started`, execute via `ToolCallHandler`, emit `tool_call_completed` or `tool_call_failed`, and record tool response message in conversation history.
     - Advance to next iteration.

---

## 6. CLI & UI Integration

### One-Shot Mode
In non-interactive mode (`ixia "inspect this project"`), the CLI streams real-time tool progress directly to stdout:

```text
Ixia:

→ read_file {"path":"package.json"}
✓ read_file

→ execute_command {"command":"pnpm test"}
✓ execute_command

The project has 25 test suites with 191 tests, all currently passing.
```

### Interactive Ink Terminal UI
In interactive terminal sessions (`InteractiveScreen`):
- Active tool executions are displayed with live indicators (`→ read_file`, `✓ read_file`, `✗ read_file`).
- Text streams progressively to the screen as tokens arrive from the model.
- Pressing **Ctrl+C** during tool execution interrupts the running command without exiting the session or losing history.
- Concurrency locks prevent overlapping submissions while an agent run is active.
