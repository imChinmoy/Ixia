# Sora

AI coding agent for your terminal.

## Status

**Phase 0 + Phase 1 Complete**

> [!NOTE]
> Sora is currently in Phase 1 (Terminal CLI Interface). LLM integration, agent execution, tool-calling, and filesystem operations will be implemented in subsequent phases.

## Features

- **Interactive Terminal UI**: Full interactive Ink/React terminal interface with input prompt, history, and status bar.
- **One-Shot Command Execution**: Execute prompt commands directly via `sora "<prompt>"`.
- **Clean Separation of Concerns**: Strict boundary between CLI presentation, application layer, and core foundations.
- **Structured Monorepo**: pnpm workspaces with dedicated packages for core types, configuration, logging, and shared utilities.
- **Strict TypeScript & ESM**: Type-safe codebase configured with strict compiler flags and NodeNext ESM resolution.

## Architecture

```text
                    SORA
                     │
              ┌──────▼──────┐
              │ CLI Layer   │  apps/cli (Commander, Ink UI)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Application │  Command orchestration & UI controllers
              │    Layer    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │    Core     │  packages/core, config, logger, shared
              └─────────────┘
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Usage

```bash
# Launch interactive terminal mode
sora

# Run in one-shot mode
sora "hello"

# Display help information
sora --help

# Display version information
sora --version
```

### Development Scripts

```bash
# Start CLI in development mode (using tsx)
pnpm dev

# Build all packages
pnpm build

# Run unit tests
pnpm test

# Check types across workspace
pnpm typecheck

# Run linter
pnpm lint

# Format code with Prettier
pnpm format
```

## Roadmap

- [x] **Phase 0** → Project Foundation (pnpm workspace, strict TypeScript, config, logger, core types)
- [x] **Phase 1** → Terminal CLI Interface (Commander parsing, Ink interactive UI, one-shot mode)
- [ ] **Phase 2** → LLM Provider Integration
- [ ] **Phase 3** → Conversation Engine
- [ ] **Phase 4** → Tool Calling System
- [ ] **Phase 5** → Filesystem Operations & Intelligence
- [ ] **Phase 6** → Shell Execution & Test Runner
- [ ] **Phase 7** → Autonomous Agent Orchestration
