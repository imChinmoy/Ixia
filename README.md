# Ixia

AI coding agent for your terminal.

## Current Status

Phase 10 — Verification & Self-Correction

### Completed

- [x] Phase 0 — Project Foundation
- [x] Phase 1 — Terminal CLI
- [x] Phase 2 — Groq LLM Integration
- [x] Phase 2.5 — UI Polish
- [x] Phase 3 — Conversation Engine
- [x] Phase 4 — Tool System
- [x] Phase 5 — Filesystem Intelligence
- [x] Phase 6 — Terminal / Shell Tool
- [x] Phase 7 — Agent Loop
- [x] Phase 8 — Repository Context Engine
- [x] Phase 9 — Planning System
- [x] Phase 10 — Verification & Self-Correction

---

## Current Capabilities

- Interactive terminal interface
- One-shot prompts
- Groq LLM integration
- Streaming responses
- Multi-turn conversations
- Conversation history
- Conversation clearing
- Provider abstraction
- Conversation state management
- Error handling

### Agent Loop & Autonomous Execution

- Multi-turn autonomous tool execution loop
- Real-time asynchronous lifecycle event streaming
- Single-turn parallel tool execution
- Tool failure recovery (tool errors fed back as structured context)
- Safety limits (`maxIterations` and `maxToolCalls`)
- Responsive execution cancellation via `AbortSignal` (Ctrl+C in terminal)
- Concurrency lock protecting against overlapping runs
- Provider-agnostic runtime architecture

### Tool System

- Generic tool abstraction
- Tool registry
- Tool execution
- Tool schema validation
- Structured tool results
- Provider-independent tool calls

### Filesystem Intelligence

- List directories
- Read text files
- Read selected line ranges
- Search text across project files
- Inspect file metadata
- Workspace-aware path resolution
- Workspace boundary protection
- Search and file-size limits
- Ignored-directory handling

### Terminal / Shell Tool

- Asynchronous shell command execution
- Captures stdout, stderr, exit code, and execution duration
- Working directory control anchored to workspace
- Execution timeout management with clean process termination
- Request cancellation via `AbortSignal`
- Bounded memory buffers for process outputs
- Structured error normalization

### Repository Context Engine

- Deterministic, offline workspace discovery and boundary validation
- Project type detection (Node.js, TypeScript, Python, Rust, Go, Flutter, etc.)
- Language composition analysis and primary language identification
- Package manager detection (`pnpm`, `npm`, `yarn`, `bun`, `cargo`, `poetry`, etc.)
- Monorepo area and workspace package detection (`apps/*`, `packages/*`, `services/*`)
- Bounded ASCII directory tree generator with depth and character budgets
- Heuristic candidate file relevance ranking based on query tokens, domain synonyms, and file signals
- Automatic secret protection: sensitive files (`.env`, `*.key`, `*.pem`, `credentials.*`, `secrets.*`) score 0 and are never read into LLM context
- In-memory workspace caching with configurable TTL
- Seamless agent loop orientation context injection

### Planning System

- Structured, provider-independent plan generation for complex tasks
- Step dependency graph with cycle detection (3-color DFS)
- Resilient plan state machine with immutable snapshots
- Adaptive planning policy distinguishing simple queries from multi-step engineering tasks
- Fast plan-only intent detection and formatted terminal presentation
- Step-by-step loop coordination within `AgentRuntime`
- Interactive terminal UI plan widget (`PlanView`) and `/plan` slash command

### Verification & Self-Correction

- Concrete, evidence-based verification architecture (tool success ≠ task success)
- Automatic verification discovery from repository configuration (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, etc.)
- Targeted verification selection proportional to step, task, and final goals
- Structured failure categorization and diagnostic analysis (type errors, test failures, lint errors, build errors, environment errors)
- Compact, bounded self-correction loop executed through the existing `AgentRuntime`
- Strict retry and resource policies (`maxVerificationAttempts`, `maxChecks`, `maxOutputCharacters`, `maxVerificationDurationMs`)
- Comprehensive cancellation via `AbortSignal` with clean child process termination
- Real-time verification events streamed to terminal CLI and interactive UI

---

## Not Implemented Yet

- File modification
- File creation
- File deletion
- Repository indexing
- Semantic code search / embeddings
- RAG
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
                            │  AgentEvents / AbortSignal
                     ┌──────▼──────┐
                     │ AgentRuntime│  packages/agent (State Machine,
                     │  AgentLoop  │  Step Orchestration, Limits, Streaming)
                     └──────┬──────┘
                            │
       ┌────────────┬───────┴───────┬────────────┬──────────────┐
       ▼            ▼               ▼            ▼              ▼
┌──────────────┐┌───────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│ Conversation ││Context Engine ││PlanningSystem││ Verification ││ Tool System  │
│(packages/core││(@ixia/context)││(@ixia/planner││(@ixia/verif.)││(Registry/Exec│
└──────┬───────┘└───────────────┘└──────────────┘└──────┬───────┘└──────┬───────┘
       │  Prompt & Context Generation                   │               │
       ▼                                                │               │
┌──────────────┐                                        │               │
│ LLM Provider │                                        │               │
│(packages/llm)│                                        ▼               │
└──────────────┘                                  ToolExecutor ◄────────┘
                                                        │
                                                  ┌─────┴─────┐
                                                  ▼           ▼
                                            ┌──────────┐ ┌──────────┐
                                            │Filesystem│ │Shell Tool│
                                            └──────────┘ └──────────┘
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
IXIA_LLM_MODEL=openai/gpt-oss-120b
```

### Usage

```bash
# Launch interactive terminal mode
ixia

# Run in one-shot mode
ixia "Explain quicksort in 2 sentences"

# Display help information
ixia --help

# Display version information
ixia --version
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
- [x] Phase 5 — Filesystem Intelligence
- [x] Phase 6 — Terminal / Shell Tool
- [x] Phase 7 — Agent Loop
- [x] Phase 8 — Repository Context Engine
- [x] Phase 9 — Planning System
- [ ] Phase 10 — Verification & Self-Correction

### Developer Capabilities

- [ ] Phase 11 — Git Integration
- [ ] Phase 12 — Permission & Security System
- [ ] Phase 13 — Memory
- [ ] Phase 14 — MCP / External Tools
- [ ] Phase 15 — Multi-Model Architecture
- [ ] Phase 16 — Advanced Context & Code Intelligence
- [ ] Phase 17 — Productionization
