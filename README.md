# Sora

AI coding agent for your terminal.

## Status

**Phase 0 + Phase 1 + Phase 2 + Phase 2.5 + Phase 3 Complete**

> [!NOTE]
> Sora is currently at **Phase 3 (Conversation Engine)**. A robust, provider-independent conversation engine connects the terminal interface to LLM providers with full lifecycle streaming, multi-turn history, concurrency protection, and clean error recovery. Tool calling, filesystem modification, shell execution, and autonomous agent loops will be introduced in subsequent phases.

---

## Current Capabilities

- **Provider-Independent Conversation Engine**: Clean architectural separation between UI, conversation lifecycle, provider interfaces, and LLM implementations (`@sora/core`).
- **Typed Message Model**: Strongly typed `Message` model (`id`, `role`, `content`, `createdAt`) with cryptographically secure UUID generation and pure factory functions.
- **State Machine & Concurrency Control**: Rigid `ConversationStatus` (`idle`, `generating`, `error`) state machine preventing interleaved or concurrent generation requests with friendly warnings.
- **Granular Lifecycle Event Stream**: Real-time event pipeline emitting `user_message`, `generation_started`, `assistant_text_delta`, `assistant_message_completed`, `generation_completed`, and `error`.
- **History Integrity & Error Handling**: Incomplete or aborted generations are discarded without polluting conversation history; errors are mapped cleanly.
- **Groq LLM Provider**: Ultra-fast LLM streaming powered by Groq SDK (`@sora/llm`) with automatic `.env` discovery and typed error classification (authentication, rate limits, invalid model, network).
- **Polished Terminal UI**: Ink/React terminal interface with styled header, session metadata, thinking indicator (spinner), syntax-highlighted code blocks, markdown rendering, and persistent status bar.
- **Built-in Slash Commands**: In-terminal commands for quick session control (`/help`, `/clear`, `/status`, `/model`, `/exit`, `/quit`).
- **One-Shot & Interactive Modes**: Run one-off prompts directly (`sora "<prompt>"`) or launch a full conversational terminal session (`sora`).

---

## What is NOT Yet Implemented (Planned for Later Phases)

To preserve architectural cleanliness and incremental development, the following features are explicitly reserved for future phases:

- ❌ Tool calling & function calling (Phase 4)
- ❌ Filesystem access & repository search (Phase 5)
- ❌ Shell command execution & test running (Phase 6)
- ❌ Git tools & diff inspection (Phase 6)
- ❌ Autonomous agent loop & planning (Phase 7)
- ❌ MCP (Model Context Protocol) integration
- ❌ Persistent database/file session storage

---

## Architecture

```text
                     User / Terminal
                            │
                     ┌──────▼──────┐
                     │  CLI Layer  │  apps/cli (Commander.js, Ink/React UI)
                     └──────┬──────┘
                            │  ConversationEvents
                     ┌──────▼──────┐
                     │Conversation │  packages/core (ConversationManager, MessageModel,
                     │   Engine    │  State Machine, Concurrency Lock)
                     └──────┬──────┘
                            │  LLMProvider contract
                     ┌──────▼──────┐
                     │LLM Provider │  packages/llm (GroqProvider, Client, Error Mapper)
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Groq API   │  LLM Cloud Inference
                     └─────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- Groq API Key (`GROQ_PROVIDER_KEY` in `.env`)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Configuration

Create a `.env` file in the root or in your home directory:

```env
GROQ_PROVIDER_KEY=gsk_your_groq_api_key_here
SORA_LLM_MODEL=openai/gpt-oss-120b
```

### Usage

```bash
# Launch interactive terminal mode
sora

# Run in one-shot mode
sora "Explain quicksort in 2 sentences"

# Display help information
sora --help

# Display version information
sora --version
```

### Development Scripts

```bash
# Start CLI in development mode
pnpm dev

# Run unit tests across all packages
pnpm test

# Check types across workspace
pnpm typecheck

# Run linter
pnpm lint

# Format code with Prettier
pnpm format
```

---

## Roadmap

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 0** | Project Foundation (pnpm workspace, strict TypeScript, config, logger, core types) | ✅ Complete |
| **Phase 1** | Terminal CLI Interface (Commander parsing, Ink interactive UI, one-shot mode) | ✅ Complete |
| **Phase 2** | Groq LLM Provider (LLM abstraction, Groq SDK streaming, error handling) | ✅ Complete |
| **Phase 2.5** | Terminal UI Polish (Ink components, markdown, code highlighting, slash commands) | ✅ Complete |
| **Phase 3** | Conversation Engine (Session state, lifecycle events, concurrency lock, message model) | ✅ Complete |
| **Phase 4** | Tool Calling System (Tool definitions, parser, dispatcher) | ⏳ Upcoming |
| **Phase 5** | Filesystem Operations & Repository Intelligence (File reading, editing, diffing, search) | ⏳ Upcoming |
| **Phase 6** | Shell Execution & Test Runner (Terminal execution, output streaming, test recovery) | ⏳ Upcoming |
| **Phase 7** | Autonomous Agent Loop & Orchestration (Multi-step reasoning, plan execution) | ⏳ Upcoming |
