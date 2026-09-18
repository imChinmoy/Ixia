# Conversation Engine Architecture

The Conversation Engine sits between the Sora user interface (CLI / Ink terminal UI) and LLM providers. It serves as a provider-independent session manager responsible for managing message history, streaming lifecycle events, managing conversation state, and guarding against concurrent execution.

```text
User / Terminal UI
        │
        ▼
   Sora CLI Layer (Interactive / One-shot)
        │
        ▼
Conversation Engine (@sora/core)
   - Message Model & Factories
   - In-memory ConversationState
   - Streaming Event Accumulator
   - Concurrency Lock & Validation
        │
        ▼
Provider Abstraction (LLMProvider interface)
        │
        ▼
Provider Implementation (@sora/llm / GroqProvider)
        │
        ▼
LLM Inference API (Groq API / Other LLMs)
```

---

## 1. Provider Independence

The Conversation Engine resides in `@sora/core` and has zero dependencies on any specific LLM provider or vendor SDK (e.g. `groq-sdk`). It interacts exclusively through the `LLMProvider` contract:

```typescript
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  stream(messages: Message[], options?: LLMRequestOptions): AsyncIterable<LLMEvent>;
}
```

Any provider (Groq, OpenAI, Anthropic, or mock implementations in tests) can be plugged in without changing a single line of conversation logic.

---

## 2. Message Model

The `Message` interface is immutable and provider-agnostic:

```typescript
export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
}
```

### Factory Functions

Messages are constructed through pure factory functions that generate unique UUIDs (`crypto.randomUUID()`):

- `createMessage(role, content, id?, createdAt?)`
- `createUserMessage(content, id?, createdAt?)`
- `createAssistantMessage(content, id?, createdAt?)`
- `createSystemMessage(content, id?, createdAt?)`

---

## 3. Conversation State Machine

The conversation lifecycle follows a strict state transition model:

```text
              send()
  ┌──────┐ ───────────► ┌────────────┐
  │ IDLE │              │ GENERATING │
  └──────┘ ◄─────────── └────────────┘
     ▲       completion        │
     │                         │ error
     │                         ▼
     │      clear() / send() ┌───────┐
     └────────────────────── │ ERROR │
                             └───────┘
```

- **`idle`**: The engine is ready to accept a new user prompt.
- **`generating`**: An LLM stream is currently active. Any concurrent `send()` invocation is rejected immediately.
- **`error`**: The previous turn encountered an error. The session remains usable; sending a subsequent prompt transitions the state back to `generating`.

---

## 4. Lifecycle Event Stream

`ConversationManager.send(prompt)` returns an `AsyncIterable<ConversationEvent>` that emits granular lifecycle events for consumption by the UI:

| Event Type                    | Payload                | Description                                                                                       |
| :---------------------------- | :--------------------- | :------------------------------------------------------------------------------------------------ |
| `user_message`                | `{ message: Message }` | Emitted when user prompt is accepted and recorded in history.                                     |
| `generation_started`          | —                      | Emitted when provider request begins; triggers thinking/spinner indicators.                       |
| `assistant_text_delta`        | `{ content: string }`  | Emitted as chunks stream from the LLM provider; updates streaming UI token-by-token.              |
| `assistant_message_completed` | `{ message: Message }` | Emitted when the full response has been accumulated and committed to history as a single message. |
| `generation_completed`        | —                      | Emitted when the generation turn concludes cleanly and status returns to `idle`.                  |
| `error`                       | `{ error: Error }`     | Emitted if provider streaming or networking fails; status transitions to `error`.                 |

---

## 5. Concurrency Protection

To prevent interleaved requests or corrupted multi-turn states:

1. **State Lock**: `ConversationManager.send()` inspects `this.status`. If `status === 'generating'`, it throws a `ConversationBusyError`:
   ```text
   A request is already in progress. Please wait until generation finishes.
   ```
2. **UI Interactivity Guard**: When `status === 'generating'`, the interactive Ink terminal UI disables input prompt entry (`isDisabled={uiState !== 'input'}`). If triggered externally, a clear user-facing warning is rendered and the prompt is not queued.

---

## 6. System Message Management

- The system prompt defines Sora's persona and constraints (`DEFAULT_SYSTEM_PROMPT`).
- The system prompt is **never added** to the public conversation history (`getMessages()`).
- During generation, the system message is prepended to the provider payload: `[systemMessage, ...history]`.
- Custom system prompts can be set via `setSystemPrompt(prompt)`.

---

## 7. History Integrity & Error Handling

- While streaming, incoming tokens are buffered into memory (`accumulatedText`).
- Only upon complete, error-free streaming is a single `assistant` message instantiated and appended to conversation history.
- If a failure occurs (network timeout, rate limit, authentication failure), no incomplete or empty assistant message is saved to history. The history remains clean and consistent.
- `clear()` resets history to `[]` and status to `'idle'`.
