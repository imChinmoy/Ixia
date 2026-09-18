# Ixia Architecture Overview

Ixia is an AI-powered coding and developer CLI designed for terminal-first development workflows.

## Design Principles

The primary architectural principle of Ixia is **strict separation of concerns**. The UI and terminal presentation layers never contain application, execution, or orchestration logic.

### Layered Architecture

```text
                    IXIA
                     │
              ┌──────▼──────┐
              │ CLI Layer   │  Commander.js, argument parsing, commands
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ Application │  Session orchestration, state management, UI coordinators
              │    Layer    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │    Core     │  Types, constants, error models, shared configs
              └─────────────┘
```

In future phases, the application layer will interface with:

```text
CLI
 ↓
Application
 ↓
Agent
 ↓
Context
 ↓
Tools
 ↓
LLM Provider
```

## Monorepo Layout

Ixia is organized as a pnpm workspace with strict TypeScript and ESM across all packages:

- `apps/cli` (`@ixia/cli`): The terminal CLI entrypoint, Commander registration, and Ink terminal UI components.
- `packages/core` (`@ixia/core`): Fundamental types, constants, and typed error hierarchies.
- `packages/config` (`@ixia/config`): Configuration management, default settings, and future configuration expansion points.
- `packages/logger` (`@ixia/logger`): Isolated logging abstraction decoupled from standard terminal output.
- `packages/shared` (`@ixia/shared`): Path formatting, terminal box rendering, and terminal rendering interfaces.

## Current Phases

- **Phase 0 — Foundation**: Monorepo configuration, TypeScript strict setup, linting, formatting, testing, and core packages.
- **Phase 1 — Terminal CLI Interface**: Commander CLI parser, interactive Ink terminal interface, one-shot prompt runner, graceful exit handling.
