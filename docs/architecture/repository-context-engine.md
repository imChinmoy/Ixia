# Repository Context Engine Architecture

The **Repository Context Engine** (`@sora/context`) provides Sora with an offline, deterministic, and bounded orientation snapshot of the workspace before the agent begins executing multi-turn tool loops.

Prior to Phase 8, Sora started each task without any structural awareness of the repository, requiring exploratory tool calls (`list_directory`, `search_files`) to determine basic properties such as project type, languages, package manager, and layout. The Repository Context Engine automatically analyzes the workspace in milliseconds, generating a compact context block that is injected into the system prompt.

```text
                               ┌──────────────────┐
                               │   User Prompt    │
                               └────────┬─────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │   AgentRuntime   │
                               └────────┬─────────┘
                                        │
                      ┌─────────────────┴─────────────────┐
                      ▼                                   ▼
          (Emit: context_build_started)      ┌─────────────────────────┐
                                             │RepositoryContextBuilder │
                                             └────────────┬────────────┘
                                                          │
                               ┌──────────────────────────┴──────────────────────────┐
                               ▼                                                     ▼
                     ┌───────────────────┐                                 ┌───────────────────┐
                     │   ContextCache    │ ◄── (Check Workspace Root TTL) ─┤   FileDiscovery   │
                     └─────────┬─────────┘                                 └─────────┬─────────┘
                               │                                                     │
                               │                                       ┌─────────────┴─────────────┐
                               │                                       ▼                           ▼
                               │                             ┌───────────────────┐       ┌───────────────────┐
                               │                             │   IgnoreManager   │       │SensitiveClassifier│
                               │                             │(.gitignore parser)│       │ (Zero-Score Guard)│
                               │                             └───────────────────┘       └───────────────────┘
                               ▼
                ┌─────────────────────────────┐
                │        Detectors            │
                │ • Project Type Detector     │
                │ • Language Detector         │
                │ • Package Manager Detector  │
                │ • Area Detector (Monorepo)  │
                └──────────────┬──────────────┘
                               │
                               ▼
                ┌─────────────────────────────┐
                │      StructureBuilder       │ ──► Bounded ASCII Tree
                └──────────────┬──────────────┘
                               │
                               ▼
                ┌─────────────────────────────┐
                │     Relevance Heuristics    │
                │ • Tokenizer (camelCase/syn) │
                │ • Scorer (weights + signals)│
                │ • Selector (top candidates) │
                └──────────────┬──────────────┘
                               │
                               ▼
                ┌─────────────────────────────┐
                │       BudgetEnforcer        │ ──► Total & Segment Limits
                └──────────────┬──────────────┘
                               │
                               ▼
              (Emit: context_build_completed)
                               │
                               ▼
                ┌─────────────────────────────┐
                │          AgentLoop          │
                │   (Appends initialContext   │
                │    to System Prompt)        │
                └──────────────┬──────────────┘
                               │
                               ▼
                ┌─────────────────────────────┐
                │      Multi-Turn LLM Run     │
                └─────────────────────────────┘
```

---

## 1. Core Design Principles

1. **Deterministic & Offline**: Operates strictly using local filesystem analysis without external network requests, vector databases, embeddings, or LLM-generated summaries.
2. **Strict Security & Secret Protection**: Sensitive files (`.env`, `*.key`, `*.pem`, `credentials.*`, `secrets.*`) receive a relevance score of `0`, are never selected as candidate files, and their contents are **never** read into the LLM context.
3. **Bounded & Budget-Enforced**: Strict character and depth limits prevent repository snapshots from overwhelming the LLM's context window.
4. **Resilient & Gracefully Degrading**: If discovery fails or encounters an unreadable directory, the engine emits `context_build_failed` and allows the agent loop to continue with standard tool execution.
5. **Caching**: In-memory workspace snapshots avoid redundant filesystem traversals across rapid interactive turns.

---

## 2. Component Breakdown

### 2.1 Workspace Discovery & Ignore Rules

- **`FileDiscovery`**: Bounded recursive traversal using `@sora/filesystem`'s `PathService` to validate workspace boundaries and protect against symlink traversal attacks.
- **`IgnoreManager`**: Enforces default ignore directories (`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `target`, `.cache`, `.turbo`, etc.) and parses workspace `.gitignore` files supporting:
  - Wildcard globs (`*.log`, `*.tmp`)
  - Directory-only patterns (`temp/`)
  - Root-anchored rules (`/root-only.txt`)
  - Negation overrides (`!keep.log`)
- **`SensitiveFileClassifier`**: Detects sensitive files by pattern matching (`.env`, `.env.*`, `*.key`, `*.pem`, `credentials.*`, `secrets.*`). Example files like `.env.example`, `.env.sample`, and `.env.template` are recognized as safe configuration templates.

### 2.2 Detectors

- **`ProjectDetector` (`detectProjectTypes`)**: Identifies project frameworks and ecosystems from manifest files:
  - `Node.js` (`package.json`)
  - `TypeScript` (`tsconfig.json`)
  - `Python` (`pyproject.toml`, `requirements.txt`, `Pipfile`)
  - `Rust` (`Cargo.toml`)
  - `Go` (`go.mod`)
  - `Flutter/Dart` (`pubspec.yaml`)
  - `Java/Maven` (`pom.xml`)
  - `Gradle` (`build.gradle`, `build.gradle.kts`)
  - `C/C++` (`CMakeLists.txt`)
  - `Make` (`Makefile`)
- **`LanguageDetector` (`detectLanguages`)**: Aggregates file extensions across discovered non-ignored files, ranking languages by occurrence and identifying the primary language.
- **`PackageManagerDetector` (`detectPackageManager`)**: Identifies package managers from lockfiles (`pnpm-lock.yaml` -> `pnpm`, `package-lock.json` -> `npm`, `yarn.lock` -> `yarn`, `bun.lockb` / `bun.lock` -> `bun`, `Cargo.lock` -> `cargo`, `poetry.lock` -> `poetry`). Detects `"multiple"` if conflicting lockfiles exist.
- **`AreaDetector` (`detectProjectAreas`)**: Analyzes directory hierarchies for monorepo layouts (`apps/*`, `packages/*`, `services/*`).

### 2.3 Structure Builder

- **`StructureBuilder`**: Generates a compact ASCII directory tree representing top-level and first-level modules.
- Enforces depth limits (default: depth 3) and entry counts.
- Displays `...` indicators when child branches exceed depth limits, guaranteeing predictable size.

### 2.4 Relevance Heuristics

The engine ranks workspace files against the incoming user query using offline lexical and structural heuristics:

1. **`tokenizeQuery`**:
   - Splits camelCase, PascalCase, snake_case, and kebab-case tokens (e.g. `authService` -> `['auth', 'service']`).
   - Filters English stopwords (`how`, `does`, `the`, `work`).
   - Expands domain synonyms (`auth` <-> `authentication`, `db` <-> `database`, `test` <-> `spec`, `doc` <-> `readme`).
2. **`RelevanceScorer`**:
   - Scores exact filename tokens, partial filename matches, and directory matches.
   - Boosts test files if query mentions tests/spec; penalizes tests if query asks about production logic.
   - Boosts documentation files for doc queries.
   - Awards an importance bonus to manifests, configs, and entrypoints.
   - **Forces score to 0** for any sensitive file.
3. **`RelevanceSelector`**:
   - Returns top N candidates (default: 10).
   - Falls back to primary manifests and entry points if the query has no specific keyword matches.

### 2.5 Budget Enforcer & Caching

- **`BudgetEnforcer`**: Enforces strict character and item limits:
  - `maxFiles`: 10
  - `maxTotalCharacters`: 6,000 characters
  - `maxStructureCharacters`: 1,500 characters
  - `maxStructureDepth`: 3
  - `maxReadmeCharacters`: 800 characters
- **`ContextCache`**: In-memory cache holding `CachedWorkspaceData` keyed by canonical root path with a 60-second TTL. Supports manual invalidation and eviction.

---

## 3. Formatted Prompt Context Example

The generated block is injected into the system prompt of the `AgentLoop`:

```markdown
[Repository Context]
Workspace: /home/user/project
Project: Node.js, TypeScript (Monorepo)
Languages: TypeScript (85%), JavaScript (15%)
Package Manager: pnpm
Areas: apps/cli, packages/agent, packages/core, packages/filesystem, packages/tools
Entry Points: apps/cli/src/index.ts, packages/agent/src/index.ts

Structure:
.
├── apps/
│   └── cli/
│       └── ...
├── packages/
│   ├── agent/
│   ├── core/
│   ├── filesystem/
│   └── tools/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json

Key Files:
- package.json
- tsconfig.json
- README.md

Likely Relevant Candidate Files:
- packages/agent/src/loop/agent-loop.ts
- packages/agent/src/runtime/agent.runtime.ts

Project Overview (from README):
Sora is an AI-powered developer coding CLI...

Notice: The above candidate files and structure are for orientation. Always use tools (read_file, search_files) to inspect and verify actual code before answering.
```

---

## 4. Agent Runtime Integration

In `AgentRuntime.runStream()`:

```typescript
// 1. Emit start event
yield { type: 'agent_started', runId, prompt: trimmed };

// 2. Build repository context snapshot
let initialContext: string | undefined;
if (this.contextBuilder && !options?.skipContext) {
  yield { type: 'context_build_started' };
  try {
    const snapshot = await this.contextBuilder.build({
      rootPath: options?.cwd ?? this.config.cwd,
      query: trimmed,
    });
    initialContext = snapshot.formattedPromptContext;
    yield { type: 'context_build_completed', snapshot };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    yield { type: 'context_build_failed', error };
    // Gracefully continues run without context
  }
}

// 3. Run AgentLoop with initial context injected into system prompt
const loop = new AgentLoop({
  conversationManager: this.conversationManager,
  toolRegistry: this.toolRegistry,
  toolExecutor: this.toolExecutor,
  config: this.config,
  initialContext,
});
```

---

## 5. Security Guarantees

1. **Path Traversal Protection**: All paths resolved through `PathService.resolveSafePath()` to guarantee operations remain inside the workspace root.
2. **Secret File Exclusion**: Sensitive files (`.env`, `id_rsa`, `*.pem`, `credentials.*`, `secrets.*`) are flagged during discovery. Their score is forced to `0`, they are excluded from candidate lists, and their contents are never read.
3. **Safe README Inspection**: Only the top-level README is read, bounded to 800 characters to prevent prompt bloat.
