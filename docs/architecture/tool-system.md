# Tool System Architecture

The **Tool System** provides a generic, provider-independent infrastructure for declaring, registering, discovering, validating, and executing tools in Sora.

It serves as the bridge between model-generated tool calls and real-world actions (filesystem, terminal commands, code search, Git operations), while maintaining strict decoupling from specific LLM providers (e.g. Groq, Anthropic, OpenAI) and user interfaces.

```text
               User / Terminal UI
                       │
                       ▼
               Conversation Engine
                       │
                       ▼
                  LLM Provider
                       │
                       ▼
              Sora Tool Call Model
                       │
                       ▼
                  Tool System
         ┌─────────────┴─────────────┐
         ▼                           ▼
   Tool Registry               Tool Executor
  (Store/Discover)            (Validate/Execute)
         │                           │
         │                     Input Validator
         │                           │
         └─────────────┬─────────────┘
                       ▼
                  Tool Results
              (Normalized Success /
                Structured Errors)
```

---

## 1. Why the Tool System Exists

LLMs in isolation can only generate text. To build an AI coding assistant that can reason about codebases, fix bugs, run test suites, and inspect repositories, the assistant must be capable of interacting with the external environment through tools.

However, naive tool implementations introduce severe architectural pitfalls:

- Tightly coupling tool definitions to vendor-specific schemas (e.g. OpenAI function-calling format or Groq SDK types).
- Directly executing tools from within LLM streaming callbacks without argument validation or error boundaries.
- Entangling autonomous decision loops before the foundational execution primitives are solid.

The Tool System in Sora solves this by establishing a **clear, isolated abstraction layer** where tools are pure TypeScript classes that declare a JSON Schema-compatible input specification and an async execution method.

---

## 2. Tool Abstraction (`@sora/tools`)

A tool in Sora implements the `Tool<TInput, TResult>` interface:

```typescript
export interface Tool<TInput = unknown, TResult = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;

  execute(input: TInput, context: ToolExecutionContext): Promise<TResult>;
}
```

### Key Properties:

- **Provider-Independent**: The tool has no awareness of Groq, OpenAI, or any particular model.
- **UI-Agnostic**: The tool has no dependencies on Ink, React, or terminal formatting.
- **Strongly Typed**: Input and return types are parameterized and enforced.
- **Context-Aware**: Receives an isolated execution context (`cwd`, `signal`, `requestId`) per call.

---

## 3. Tool Schema & Input Validation

The input schema exposed to LLM providers is modeled after standard JSON Schema object definitions:

```typescript
export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: readonly string[];
  description?: string;
  additionalProperties?: boolean;
}
```

### Pure Schema Validator

Before executing any tool, the `ToolExecutor` passes raw arguments through `validateToolInput()`:

- Verifies that input is a valid object.
- Validates all required fields are present and non-undefined.
- Verifies types (`string`, `number`, `integer`, `boolean`, `array`, `object`, `null`).
- Recursively validates nested object properties and array item types.
- Enforces `enum` constraints.
- Rejects unexpected properties if `additionalProperties: false`.

If validation fails, execution is halted immediately and a structured `ToolValidationError` is returned without executing the tool.

---

## 4. Tool Registry (`ToolRegistry`)

`ToolRegistry` provides centralized registration, discovery, and definition generation:

```typescript
export class ToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): boolean;
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  list(): readonly Tool[];
  getDefinitions(): readonly ToolDefinition[];
  clear(): void;
}
```

### Responsibilities:

- **Registration**: Ensures unique tool names; duplicate tool registrations throw a `ToolRegistrationError`.
- **Discovery**: Enables looking up tools by string identifier.
- **LLM Definitions**: Exposes provider-neutral `ToolDefinition[]` that LLM provider adapters convert into provider-specific tool representations.
- **Separation of Concerns**: The registry only stores and discovers tools; it never executes them.

---

## 5. Tool Executor (`ToolExecutor`)

`ToolExecutor` orchestrates the validation and execution pipeline:

```typescript
export class ToolExecutor {
  constructor(options: ToolExecutorOptions);
  execute(
    toolCall: ToolCall,
    context?: Partial<ToolExecutionContext>,
  ): Promise<ToolExecutionResult>;
}
```

### Execution Pipeline:

```text
ToolCall
   │
   ▼
1. Discover Tool from ToolRegistry
   │ (if missing ➔ ToolNotFoundError)
   ▼
2. Validate Input with validateToolInput
   │ (if invalid ➔ ToolValidationError)
   ▼
3. Construct Isolated ToolExecutionContext
   │ (cwd, abort signal, requestId)
   ▼
4. Pre-execution Abort Check
   │ (if aborted ➔ ToolExecutionError)
   ▼
5. Asynchronously execute tool.execute()
   │
   ├── Succeeded ➔ { success: true, result }
   └── Threw error ➔ { success: false, error: ToolExecutionError }
```

### Concurrency & Isolation:

- No global mutable state is shared across executions.
- Each invocation builds its own `ToolExecutionContext`.
- Abort signals are checked before execution begins and forwarded to the tool.

---

## 6. Provider-Independent Tool Call & Result Models

### Tool Call (`ToolCall`)

```typescript
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}
```

### Tool Execution Result (`ToolExecutionResult`)

```typescript
export interface ToolExecutionResult<TResult = unknown> {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly result?: TResult;
  readonly error?: ToolError;
}
```

The result explicitly distinguishes between:

- Successful tool runs (`success: true`, `result: TResult`)
- Missing tools (`ToolNotFoundError`)
- Schema validation failures (`ToolValidationError`)
- Tool runtime exceptions (`ToolExecutionError`)
- Internal system failures (`ToolSystemError`)

---

## 7. Structured Error Architecture

All tool errors integrate into Sora's core error hierarchy by extending `SoraError`:

```text
SoraError (@sora/core)
   │
   └── ToolError (@sora/tools)
         ├── ToolNotFoundError
         ├── ToolValidationError
         ├── ToolExecutionError
         ├── ToolRegistrationError
         └── ToolSystemError
```

Every `ToolError` encapsulates:

- `toolName`: Name of the tool involved.
- `toolCallId`: Associated tool call ID (when applicable).
- `code`: Normalized error code (`TOOL_NOT_FOUND`, `TOOL_VALIDATION_ERROR`, etc.).
- `cause`: Underlying exception or diagnostic detail.
- Safe messages without leaking environment secrets or API tokens.

---

## 8. Provider Boundary & Groq Adapter

The dependency direction strictly enforces dependency inversion:

```text
Tool System (@sora/tools)
       ▲
       │
LLM Provider Adapter (@sora/llm / GroqProvider)
```

The Tool System **never** imports `groq-sdk` or provider implementations.

Instead, the provider layer (`@sora/llm`) translates between Sora's neutral representations and provider APIs:

- `toGroqTools(tools?: readonly ToolDefinition[])`: Maps generic `ToolDefinition[]` to `Groq.Chat.ChatCompletionTool[]`.
- `toSoraToolCall(accumulated)`: Reassembles streaming `delta.tool_calls` chunks from the provider into a generic Sora `ToolCall`.

The LLM provider event stream emits:

```typescript
{
  type: 'tool_call';
  toolCall: ToolCall;
}
```

---

## 9. Built-in Test Tool (`EchoTool`)

To verify the complete lifecycle without external side-effects, Sora includes `EchoTool`:

```typescript
export class EchoTool implements Tool<EchoInput, string> {
  readonly name = 'echo';
  readonly description = 'Echoes back the input message.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message to echo back.' },
    },
    required: ['message'],
  };

  async execute(input: EchoInput, context: ToolExecutionContext): Promise<string> {
    return input.message;
  }
}
```

---

## 10. Why the Autonomous Agent Loop is NOT Implemented Yet

Phase 4 explicitly concludes at:

```text
LLM Provider emits ToolCall ➔ ToolExecutor executes ToolCall ➔ ToolExecutionResult returned
```

There is **intentionally no autonomous feedback loop** returning tool results to the LLM.

Autonomous execution requires:

1. Multi-turn tool response message injection (`role: 'tool'`).
2. Security permission and policy evaluation (Phase 12).
3. Loop termination criteria, recursion limits, and step budgets (Phase 7).
4. Planning, self-correction, and verification (Phases 9 & 10).

Implementing the agent loop before filesystem tools (Phase 5) and shell tools (Phase 6) are available would result in an untested, fragile loop without real-world developer tools. The Agent Loop will be properly introduced in Phase 7.

---

## 11. How Future Tools Will Plug In

Future capabilities will be implemented as standard `Tool` implementations registered into `ToolRegistry`:

- **Phase 5 (Filesystem)**:
  - `read_file`: Reads text files within repository bounds.
  - `write_file` / `edit_file`: Modifies files with path policy enforcement.
  - `list_directory`: Traverses directories respecting `.gitignore`.
- **Phase 6 (Shell)**:
  - `run_command`: Executes terminal commands with timeout, streaming, and approval guards.
- **Phase 11 (Git)**:
  - `git_status`, `git_diff`, `git_log`: Inspects repository version control status.

Because all tools conform to `Tool<TInput, TResult>` and execute via `ToolExecutor`, future tools automatically inherit schema validation, error normalization, abort signals, and upcoming security policy checks.
