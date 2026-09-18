# Filesystem Intelligence Architecture

The **Filesystem Intelligence** layer (`@sora/filesystem`) provides Sora with read-only inspection capabilities across a developer's local project repository. It bridges the generic Tool System from Phase 4 with the physical filesystem through a robust security and path-boundary abstraction.

```text
                    ┌──────────────────┐
                    │    Sora CLI/UI   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Conversation   │
                    │      Engine      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   LLM Provider   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Tool System    │
                    │  (ToolRegistry / │
                    │   ToolExecutor)  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        list_directory   read_file    search_files
                                             │
                                         file_info
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │ Filesystem       │
                    │ Service          │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Workspace        │
                    │ Boundary Check   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Node Filesystem  │
                    │ (fs/promises)    │
                    └──────────────────┘
```

---

## 1. Why Filesystem Intelligence Exists

To assist developers effectively, an AI coding assistant cannot rely on pre-trained knowledge alone—it must be capable of grounding its reasoning in the actual project code.

Filesystem Intelligence provides the sensory capabilities needed to:

- Explore project structure and discover relevant files.
- Read source code and configuration files.
- Search text across codebases without dumping entire repositories into context.
- Inspect file metadata (sizes, types, modification times) to make informed decisions.

Crucially, this phase is strictly **read-only observation**. Mutation capabilities (editing, writing, deleting) and autonomous decision loops are deliberately isolated for later phases.

---

## 2. Filesystem Architecture & Separation of Concerns

The architecture strictly decouples tool abstractions, business services, and low-level filesystem calls:

```text
Tool Layer (@sora/filesystem/tools)
  ├── ListDirectoryTool
  ├── ReadFileTool
  ├── SearchFilesTool
  └── FileInfoTool
         │
         ▼
Service Layer (@sora/filesystem/services)
  ├── FilesystemService (high-level operations & error mapping)
  ├── PathService (path validation, canonicalization & boundary enforcement)
  └── FileSearchService (bounded recursive traversal & token filtering)
         │
         ▼
Node.js Runtime (node:fs/promises & node:path)
```

No tool interacts directly with `node:fs`. All filesystem actions pass through `FilesystemService` and `PathService`, ensuring consistent security, formatting, and error normalization.

---

## 3. Workspace Concept & Context-Aware Execution

All filesystem operations are anchored to a defined **workspace root** (by default, `process.cwd()`).

Instead of reading global mutable variables, every tool receives an isolated `ToolExecutionContext`:

```typescript
export interface ToolExecutionContext {
  readonly cwd: string;
  readonly signal?: AbortSignal;
  readonly requestId?: string;
}
```

The tool retrieves `context.cwd` as the authoritative workspace root for that execution turn.

---

## 4. Path Resolution & Canonicalization

Path handling in `PathService` distinguishes:

- **Relative Path**: User or LLM input relative to workspace (e.g. `src/main.ts`).
- **Normalized Path**: Canonical path without redundant segments (`.` or `..`).
- **Resolved Path**: Absolute system path resolved against workspace root.
- **Display Path**: POSIX-standard relative path returned to the LLM (e.g. `src/utils/math.ts`).

Paths containing null bytes (`\0`) or malformed characters are immediately rejected with `InvalidPathError`.

---

## 5. Workspace Boundary Protection (Anti-Traversal & Symlinks)

Sora enforces strict workspace containment to prevent unintentional exposure of sensitive host system files:

1. **Logical Traversal Check**:
   Target paths resolved against workspace root are verified to ensure they reside strictly within `workspaceRoot`:

   ```typescript
   targetPath === workspaceRoot || targetPath.startsWith(workspaceRoot + path.sep);
   ```

   Attempts to escape via `../../../../etc/passwd` or `/etc/shadow` trigger `WorkspaceViolationError`.

2. **Symlink Escape Protection**:
   A symlink located inside the workspace may point to an arbitrary location outside it. `PathService` inspects the canonical `realpath` of both target and ancestor directories. If a symlink points outside the workspace root, access is blocked and a `WorkspaceViolationError` is raised.

---

## 6. Filesystem Service (`FilesystemService`)

`FilesystemService` provides high-level asynchronous methods:

- `listDirectory(path?, workspaceRoot?, options?)`: Lists directory entries with metadata and deterministic sorting.
- `readFile(path, workspaceRoot, options?)`: Reads text content with binary checking, size limits, and line range slicing.
- `searchFiles(options, workspaceRoot)`: Recursively scans text files with bounds on results, scanned files, and file size.
- `getFileInfo(path, workspaceRoot)`: Retrieves structured file and directory statistics.

---

## 7. The Four Filesystem Tools

All tools implement the generic Phase 4 `Tool<TInput, TResult>` interface and can be registered into any `ToolRegistry`:

### Tool 1: `list_directory`

- **Purpose**: List directory contents.
- **Input**: `{ path?: string }` (defaults to `.`).
- **Sorting**: Deterministic ordering—directories first, files second, alphabetical within category.
- **Metadata**: Returns `name`, `path`, `type` (`directory` | `file` | `symlink` | `other`), `size`, `hidden`, `modifiedAt`.

### Tool 2: `read_file`

- **Purpose**: Read UTF-8 text content from a file.
- **Input**: `{ path: string, startLine?: number, endLine?: number }`.
- **Line Slicing**: Supports 1-based inclusive ranges (`startLine` and `endLine`).
- **Metadata**: Returns `content`, `size`, `totalLines`, `startLine`, `endLine`.

### Tool 3: `search_files`

- **Purpose**: Search text queries across project files.
- **Input**: `{ query: string, path?: string, maxResults?: number }`.
- **Matching**: Line-by-line substring search reporting matched line number, text, and relative file path.
- **Metadata**: Returns `matches`, `totalMatches`, `filesScanned`, `truncated`, `reason`.

### Tool 4: `file_info`

- **Purpose**: Inspect metadata of a file or directory.
- **Input**: `{ path: string }`.
- **Metadata**: Returns `path`, `type`, `size`, `modifiedAt`, `createdAt`, `extension`, `isText`, `isHidden`.

---

## 8. Size & Search Limits

To safeguard against memory exhaustion and excessive context consumption:

- **Maximum Read File Size**: Defaults to 1 MB (`DEFAULT_MAX_READ_FILE_SIZE`). Files exceeding this limit fail with `FileTooLargeError`.
- **Maximum Search File Size**: Defaults to 512 KB (`DEFAULT_MAX_SEARCH_FILE_SIZE`). Files exceeding this size are skipped during search.
- **Maximum Search Results**: Defaults to 50 matches (`DEFAULT_MAX_SEARCH_RESULTS`). Once reached, traversal stops and `truncated: true` is reported.
- **Maximum Files Scanned**: Defaults to 1,000 files (`DEFAULT_MAX_FILES_SCANNED`). Prevents runaway traversal in massive source trees.

---

## 9. Binary File Protection

Binary files (images, audio, video, archives, compiled binaries) are blocked from text-based LLM consumption:

1. **Extension Filter**: Fast-path detection of known binary extensions (`.png`, `.jpg`, `.zip`, `.pdf`, `.exe`, `.pyc`, `.wasm`, etc.).
2. **Buffer Inspection**: Ambiguous or extensionless files have their initial 512 bytes inspected for null bytes (`0x00`).
3. If binary content is detected:
   - `read_file` throws `BinaryFileError`.
   - `search_files` automatically skips the file without halting search.
   - `file_info` marks `isText: false`.

---

## 10. Ignored Directories

By default, recursive search ignores high-volume non-source directories:

- `.git`
- `node_modules`
- `dist`
- `build`
- `coverage`
- `.next`
- `target`
- `.cache`
- `.turbo`

---

## 11. Structured Error Hierarchy

Low-level Node `fs` errors (`ENOENT`, `EACCES`, `ENOTDIR`) are normalized into structured Sora errors extending `ToolError`:

```text
SoraError (@sora/core)
   └── ToolError (@sora/tools)
         └── FilesystemError (@sora/filesystem)
               ├── FileNotFoundError
               ├── DirectoryNotFoundError
               ├── WorkspaceViolationError
               ├── BinaryFileError
               ├── FileTooLargeError
               ├── InvalidPathError
               ├── PermissionDeniedError
               └── SearchError
```

Every error retains the offending path, normalized error code, and underlying cause without leaking sensitive environment tokens.

---

## 12. Security Considerations

Phase 5 establishes Sora's first real security perimeter:

- **Strict Boundary Check**: No operation can access paths outside the resolved workspace directory.
- **Symlink Jail**: Symlinks pointing to target paths outside the workspace are blocked.
- **Read-Only Invariant**: The package contains zero APIs for writing, deleting, moving, or modifying files.
- **No Stack Trace Leaks**: Structured error messages protect host environment details from leaking to the model context.

---

## 13. Why File Modification & Agent Loop are Excluded

- **File Modification (Phase 6 / Phase 11)**: Writing and modifying code requires precise diffing, rollback capabilities, and permission systems (Phase 12). Introducing writing prematurely risks silent data loss.
- **Autonomous Agent Loop (Phase 7)**: The autonomous iteration cycle (`LLM -> Tool -> LLM -> Tool`) requires tool execution feedback messages, step budgets, and verification checks. Phase 5 strictly provides the tool implementations.
