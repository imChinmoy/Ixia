# Development Setup Guide

## Prerequisites

- Node.js >= 18 (Tested on Node.js 26)
- pnpm >= 9 (Installed via `npm i -g pnpm`)

## Getting Started

1. Clone the repository and install workspace dependencies:

```bash
pnpm install
```

2. Run the CLI in development mode:

```bash
pnpm dev
# or with arguments:
pnpm --filter @ixia/cli dev "hello"
```

3. Build all workspace packages:

```bash
pnpm build
```

4. Run the test suite:

```bash
pnpm test
```

5. Run typechecking:

```bash
pnpm typecheck
```

6. Run code linting:

```bash
pnpm lint
```

7. Format code:

```bash
pnpm format
```
