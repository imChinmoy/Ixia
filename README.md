# Sora

AI coding agent for your terminal.

## Current Status

Phase 4 — Tool System

### Completed

- [x] Phase 0 — Project Foundation
- [x] Phase 1 — Terminal CLI
- [x] Phase 2 — Groq LLM Integration
- [x] Phase 2.5 — UI Polish
- [x] Phase 3 — Conversation Engine
- [x] Phase 4 — Tool System

---

## Current Capabilities

- Interactive terminal interface
- One-shot prompts
- Groq LLM integration
- Streaming responses
- Multi-turn conversations
- Conversation history during current session
- Conversation clearing
- Provider abstraction
- Conversation state management
- Error handling
- Tool abstraction
- Tool registry
- Tool schema validation
- Tool execution
- Structured tool results
- Tool error handling
- Provider-independent tool calls

---

## Not Implemented Yet

- Filesystem tools
- Shell execution
- Autonomous agent loop
- Planning
- Repository context engine
- Repository indexing
- Code search
- Git integration
- Permission system
- Security sandbox
- Persistent memory
- MCP
- Multi-model support

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
                     │LLM Provider │  packages/llm (GroqProvider, Adapter, Error Mapper)
                     └──────┬──────┘
                            │  ToolCalls / ToolDefinitions
                     ┌──────▼──────┐
                     │ Tool System │  packages/tools (ToolRegistry, ToolExecutor,
                     │             │  Schema Validator, Structured Errors, EchoTool)
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

### Foundation

- [x] Phase 0 — Project Foundation
- [x] Phase 1 — Terminal CLI

### Intelligence

- [x] Phase 2 — LLM Integration
- [x] Phase 2.5 — UI Polish
- [x] Phase 3 — Conversation Engine
- [x] Phase 4 — Tool System
- [ ] Phase 5 — Filesystem Intelligence
- [ ] Phase 6 — Terminal / Shell Tool
- [ ] Phase 7 — Agent Loop
- [ ] Phase 8 — Repository Context Engine
- [ ] Phase 9 — Planning System
- [ ] Phase 10 — Verification & Self-Correction

### Developer Capabilities

- [ ] Phase 11 — Git Integration
- [ ] Phase 12 — Permission & Security System
- [ ] Phase 13 — Memory
- [ ] Phase 14 — MCP / External Tools
- [ ] Phase 15 — Multi-Model Architecture
- [ ] Phase 16 — Advanced Context & Code Intelligence
- [ ] Phase 17 — Productionization
