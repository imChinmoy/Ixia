# Ixia — LLM Coding CLI Building Guide

## Project Vision

**Ixia** is an AI-powered developer CLI that can understand a codebase, reason about tasks, use tools, modify files, execute commands, run tests, and iteratively fix problems.

The long-term goal is to build a system conceptually similar to modern coding agents such as Claude Code and Codex CLI.

### Core Principle

```text
User
 ↓
Ixia CLI
 ↓
Agent Runtime
 ↓
LLM
 ↕
Tools
 ↓
Filesystem / Terminal / Git / Codebase
```

> Ixia is **not** an attempt to train an LLM from scratch. It is an agentic software layer built around LLMs.

---

# Phase 0 — Project Foundation

### Goal

Set up the repository and development architecture.

### Learn

- TypeScript
- Node.js runtime
- npm/pnpm
- Monorepo basics
- Environment variables
- Configuration management
- Logging
- Error handling

### Initial Structure

```text
ixia/
├── apps/
│   └── cli/
├── packages/
│   ├── core/
│   ├── llm/
│   ├── agent/
│   ├── tools/
│   ├── context/
│   └── config/
├── tests/
├── package.json
└── README.md
```

### Milestone

```bash
ixia
```

successfully launches.

---

# Phase 1 — Terminal CLI Interface

### Goal

Build a polished interactive terminal application.

### Learn

- CLI argument parsing
- stdin/stdout
- Terminal rendering
- Interactive prompts
- Command handling
- Streaming terminal output
- Keyboard/input handling

### Build

```bash
ixia
```

Interactive interface:

```text
╭──────────────────────────────╮
│          IXIA CLI             │
╰──────────────────────────────╯

> hello

Ixia:
Hello! How can I help?

>
```

Support:

```bash
ixia
ixia "explain this project"
ixia --help
ixia --version
```

### Milestone

A clean terminal interface that can receive commands and display responses.

---

# Phase 2 — LLM Provider Integration

### Goal

Connect Ixia to an actual LLM.

### Initial Provider

Start with **OpenAI**.

Keep the architecture provider-agnostic.

```text
Ixia
 ↓
LLMProvider interface
 ↓
OpenAIProvider
 ↓
LLM API
```

Later:

```text
LLMProvider
├── OpenAI
├── Anthropic
├── Google
└── Local
```

### Learn

- LLM APIs
- API authentication
- System/user/assistant messages
- Streaming
- Token usage
- Model configuration
- Retries
- Timeouts
- Rate limits

### Build

```bash
ixia
```

Then:

```text
> Explain recursion in C++

Ixia:
...
```

### Milestone

Ixia can have a real streaming conversation with an LLM.

---

# Phase 3 — Conversation Engine

### Goal

Separate the CLI from the underlying conversation logic.

Create:

```text
ConversationManager
Message
MessageHistory
Context
```

Architecture:

```text
CLI
 │
 ▼
ConversationManager
 │
 ▼
LLMProvider
```

### Build

Support:

```text
User message
      ↓
Conversation history
      ↓
System prompt
      ↓
LLM
      ↓
Assistant response
      ↓
History
```

Add multi-turn conversation:

```text
> What is dependency injection?

> What about in Android?

> Give me an example.
```

Ixia remembers the conversation.

### Milestone

A reliable multi-turn conversation engine.

---

# Phase 4 — Tool System

### Goal

Give the LLM the ability to **do things**, not just talk.

Start with:

```text
read_file()
list_files()
search_files()
```

Architecture:

```text
                LLM
                 │
          decides tool call
                 │
                 ▼
            Tool Registry
                 │
        ┌────────┼─────────┐
        ▼        ▼         ▼
     readFile  listFiles  searchFiles
```

### Learn

- Function/tool calling
- JSON schemas
- Tool registration
- Tool execution
- Tool results
- Validation
- Error handling

### Milestone

User:

```text
> What is this project's authentication flow?
```

Ixia:

```text
I'll inspect the repository.

→ list_files()
→ search_files("auth")
→ read_file("src/auth/service.ts")
```

Then produces an answer based on the actual repository.

---

# Phase 5 — Filesystem Intelligence

### Goal

Make Ixia understand the user's repository.

Implement:

```text
list_directory
read_file
write_file
create_file
delete_file
search_files
```

Add safety restrictions.

For example:

```text
Allowed:
✓ project directory

Restricted:
✗ /etc
✗ system directories
✗ unrelated user files
```

### Learn

- Filesystem APIs
- Paths
- Permissions
- Symlinks
- File encoding
- Directory traversal
- Security boundaries

### Milestone

Ixia can inspect and modify files inside a project.

---

# Phase 6 — Terminal / Shell Tool

### Goal

Allow Ixia to execute development commands.

Implement:

```text
run_command()
```

Examples:

```text
npm install
npm test
npm run build
git status
flutter test
docker compose up
```

Architecture:

```text
LLM
 ↓
run_command()
 ↓
Command Executor
 ↓
Operating System
 ↓
stdout / stderr / exit code
 ↓
LLM
```

### Critical Safety

Never blindly execute everything the model requests.

Implement:

```text
Command
 ↓
Validation
 ↓
Permission
 ↓
User approval
 ↓
Execution
```

Example:

```text
Ixia wants to run:

npm install

Allow? [y/N]
```

### Milestone

Ixia can inspect, modify, and execute code.

---

# Phase 7 — Agent Loop

### Goal

This is the **core of Ixia**.

Turn the chatbot into an agent.

Basic loop:

```text
User Task
   ↓
LLM
   ↓
Tool Call?
   │
   ├── No → Final Response
   │
   └── Yes
         ↓
     Execute Tool
         ↓
      Tool Result
         ↓
        LLM
         ↓
      Tool Call?
         ↓
        ...
```

Pseudo-architecture:

```text
while (!finished) {

    response = LLM(messages)

    if (response.toolCall) {
        result = executeTool(response.toolCall)
        messages.push(result)
    }

    else {
        return response
    }
}
```

### Milestone

User:

```text
> Find why login is failing and fix it.
```

Ixia can autonomously:

```text
search
 ↓
read
 ↓
reason
 ↓
modify
 ↓
test
 ↓
inspect failure
 ↓
modify again
 ↓
test again
 ↓
finish
```

This is the point where **Ixia becomes an actual coding agent**.

---

# Phase 8 — Repository Context Engine

### Goal

Solve the context problem.

A repository might contain:

```text
10,000 files
millions of tokens
```

You cannot send the entire repository to the LLM.

Build a context pipeline:

```text
Repository
    ↓
File Discovery
    ↓
Filtering
    ↓
Code Search
    ↓
Relevant Files
    ↓
Relevant Sections
    ↓
Context Builder
    ↓
LLM
```

### Start Simple

Use:

```text
.gitignore
file extensions
keyword search
directory structure
recently modified files
imports
```

Later explore:

```text
AST parsing
symbol indexing
embeddings
vector search
BM25
semantic retrieval
dependency graphs
```

### Milestone

Ixia can identify the relevant parts of a large repository instead of dumping everything into context.

---

# Phase 9 — Planning System

### Goal

Make Ixia plan before making complex changes.

Instead of:

```text
Task
 ↓
Code immediately
```

use:

```text
Task
 ↓
Understand
 ↓
Analyze repository
 ↓
Create Plan
 ↓
User Approval
 ↓
Execute
```

Example:

```text
Task:
Add Google authentication.

Plan:

1. Configure Firebase authentication
2. Create AuthRepository
3. Add Google sign-in
4. Update AuthViewModel
5. Update login UI
6. Add error handling
7. Add tests

Proceed? [y/N]
```

### Milestone

Ixia can generate and execute structured implementation plans.

---

# Phase 10 — Verification & Self-Correction

### Goal

Teach Ixia to verify its own work.

Agent cycle:

```text
Plan
 ↓
Implement
 ↓
Test
 ↓
Failure?
 ├── Yes → Diagnose → Fix → Test
 └── No  → Continue
```

Example:

```text
Ixia:
I've implemented the change.

Running tests...

✗ 2 tests failed.

Analyzing failures...

→ read test
→ inspect implementation
→ modify code

Running tests again...

✓ 42 tests passed.
```

### Milestone

Ixia doesn't stop simply because it successfully edited a file.

It verifies the result.

---

# Phase 11 — Git Integration

### Goal

Make Ixia Git-aware.

Implement tools:

```text
git_status()
git_diff()
git_log()
git_branch()
git_show()
git_commit()
```

Useful commands:

```bash
ixia review
ixia explain
ixia diff
ixia commit
```

Example:

```text
> ixia review

Ixia analyzes:

✓ Modified files
✓ Git diff
✓ Tests
✓ Potential issues
```

### Important

Ixia should clearly show changes before destructive Git operations.

---

# Phase 12 — Permission & Security System

### Goal

Make Ixia safe to run on a real machine.

Create permission categories:

```text
READ
WRITE
EXECUTE
NETWORK
GIT
```

Example:

```text
READ
  project files ✓

WRITE
  project files ✓

EXECUTE
  npm test ✓
  rm -rf project ✗

NETWORK
  disabled by default
```

Implement:

```text
PermissionManager
CommandPolicy
PathPolicy
ApprovalManager
```

### Later

Explore:

```text
Docker sandbox
isolated filesystem
resource limits
network restrictions
process isolation
```

### Milestone

Ixia can safely operate without giving an LLM unrestricted access to the machine.

---

# Phase 13 — Memory

### Goal

Allow Ixia to remember useful information.

Separate:

### Conversation Memory

```text
Current conversation
```

from:

### Repository Memory

```text
Project architecture
Coding conventions
Important files
Previous decisions
```

Example:

```text
.ixia/
├── config
├── memory
├── sessions
└── index
```

Support project instructions such as:

```text
Use Riverpod.

Never modify generated files.

Run flutter test after changes.

Follow Clean Architecture.
```

### Milestone

Ixia behaves consistently across sessions.

---

# Phase 14 — MCP / External Tool Ecosystem

### Goal

Allow Ixia to connect to external tools.

Architecture:

```text
Ixia
 │
 ├── Native Tools
 │    ├── Filesystem
 │    ├── Shell
 │    └── Git
 │
 └── External Tools
      ├── MCP
      ├── GitHub
      ├── Database
      ├── Browser
      └── APIs
```

### Milestone

Third-party tools can be plugged into Ixia.

---

# Phase 15 — Multi-Model Architecture

### Goal

Allow users to choose their LLM.

```bash
ixia --model <model>
```

Architecture:

```text
             LLMProvider
             /    |     \
            /     |      \
       OpenAI  Anthropic  Local
```

Potential providers:

```text
OpenAI
Anthropic
Google
Ollama
vLLM
Other OpenAI-compatible APIs
```

### Important

The agent should not care which model is being used.

```text
Agent
 ↓
LLMProvider
 ↓
Model
```

This is a major architectural boundary.

---

# Phase 16 — Advanced Context & Code Intelligence

### Goal

Move from basic file search toward real codebase understanding.

Explore:

```text
AST
 ↓
Symbols
 ↓
Functions
 ↓
Classes
 ↓
Imports
 ↓
Call relationships
 ↓
Dependency graph
```

Potential architecture:

```text
Repository
     ↓
Parser
     ↓
Code Index
     ↓
Retriever
     ↓
Context Builder
     ↓
LLM
```

This is where Ixia starts developing its own **code intelligence layer**.

---

# Phase 17 — Productionization

### Goal

Make Ixia a real open-source developer tool.

Add:

```text
Configuration
Logging
Telemetry (optional)
Error reporting
Caching
Rate-limit handling
Retry policies
Session persistence
Testing
Documentation
Installation scripts
CI/CD
Releases
```

Distribution:

```bash
npm install -g ixia-cli
```

Eventually:

```bash
brew install ixia
```

and binaries for:

```text
Linux
macOS
Windows
```

---

# Final Architecture

The eventual Ixia architecture should roughly look like:

```text
                         ┌───────────────┐
                         │     IXIA      │
                         │      CLI      │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │ Agent Runtime │
                         └───────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
           Planner           Context             Memory
                              Engine
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                         ┌───────▼───────┐
                         │ Tool System   │
                         └───────┬───────┘
                                 │
              ┌──────────┬───────┼────────┬──────────┐
              ▼          ▼       ▼        ▼          ▼
          Filesystem   Shell    Git     Search      MCP
              │          │       │
              └──────────┴───────┴──────────────────┐
                                                     │
                                             Developer Machine
                                                     │
                         ┌───────────────────────────┘
                         │
                  ┌──────▼──────┐
                  │ LLM Provider│
                  └──────┬──────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           OpenAI    Anthropic    Local
```

---

# Recommended Development Order

Do not build all 17 phases at once.

Build these milestones sequentially:

```text
[M1] Terminal CLI
      ↓
[M2] LLM integration
      ↓
[M3] Conversation engine
      ↓
[M4] Tool calling
      ↓
[M5] Filesystem tools
      ↓
[M6] Shell execution
      ↓
[M7] Agent loop
      ↓
[M8] Repository context
      ↓
[M9] Planning
      ↓
[M10] Verification/self-correction
      ↓
[M11] Git
      ↓
[M12] Security/sandbox
      ↓
[M13] Memory
      ↓
[M14] MCP
      ↓
[M15] Multi-model
      ↓
[M16] Advanced code intelligence
      ↓
[M17] Production release
```

---

# First Major Target

Don't think about the entire roadmap while coding.

The first meaningful target is:

```text
Ixia V0.1

ixia "fix this bug"
       ↓
understand repository
       ↓
search files
       ↓
read relevant code
       ↓
modify code
       ↓
run tests
       ↓
observe result
       ↓
fix if necessary
       ↓
report completion
```

Once Ixia can reliably perform that loop, **you have built the fundamental architecture of an AI coding agent**.

Everything after that is about making the system smarter, safer, faster, and more capable.
