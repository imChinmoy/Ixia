# Planning System Architecture

The **Planning System** (`@ixia/planner`) equips Ixia with structured, provider-independent planning capabilities. It enables the agent to decompose complex, multi-step engineering tasks into explicit, trackable steps with dependency graphs before execution.

---

## 1. Architectural Role & Execution Ownership

A key design principle in Ixia is that **the Planner does not execute tools directly, nor does it spawn a secondary agent loop**. 

Instead:
1. **Planner (`@ixia/planner`)** is purely responsible for reasoning, generating, validating, and maintaining the plan's state machine.
2. **`AgentRuntime` (`@ixia/agent`)** orchestrates execution: it queries the planning policy, invokes the generator, advances steps, feeds step-specific plan context into the loop, and tracks status.
3. **`AgentLoop` (`@ixia/agent`)** retains single execution authority for LLM tool invocation turns.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant CLI as CLI (Interactive / One-Shot)
    participant AR as AgentRuntime
    participant Planner as PlannerService
    participant LLM as LLM Provider
    participant Loop as AgentLoop
    participant Tools as ToolExecutor

    User->>AR: Submit request (e.g. "Refactor auth and add tests")
    AR->>Planner: shouldPlan(input)?
    Planner-->>AR: true
    AR->>Planner: generatePlan(input, provider)
    Planner->>LLM: Stream prompt with JSON schema
    LLM-->>Planner: JSON plan response
    Planner->>Planner: Validate schema, limits & DAG cycles
    Planner-->>AR: Validated Plan
    AR->>CLI: Emit plan_created, plan_started
    
    loop For each executable step
        AR->>Planner: getNextExecutableStep()
        Planner-->>AR: PlanStep (e.g. step-1)
        AR->>CLI: Emit step_started
        AR->>Loop: run(stepContext, tools)
        Loop->>LLM: Turn stream with plan context
        LLM-->>Loop: Tool calls
        Loop->>Tools: execute(args)
        Tools-->>Loop: Tool results
        Loop-->>AR: step completed
        AR->>Planner: completeStep(step-1)
        AR->>CLI: Emit step_completed
    end

    AR->>Planner: complete()
    AR->>CLI: Emit plan_completed
    CLI-->>User: Output final results
```

---

## 2. Component Architecture

The `@ixia/planner` package consists of modular subsystems:

```text
packages/planner/
├── src/
│   ├── types/               # Plan, PlanStep, Statuses, PlanningLimits
│   ├── errors/              # PlannerError, Validation, Limits, Cycle, Transition errors
│   ├── validation/          # PlanValidator (Field checks, limits, 3-color DFS cycle detector)
│   ├── state/               # PlanState (State machine, versioning, dependency resolver)
│   ├── policy/              # DefaultPlanningPolicy (Simple vs Complex heuristic, Plan-only detector)
│   ├── generation/          # PlanGenerator & parsePlanResponse (Markdown JSON extractor)
│   ├── planner.service.ts   # Unified facade coordinating all planner components
│   └── index.ts             # Public API exports
```

### 2.1 Plan Data Model & State Machine (`PlanState`)

* **`Plan`**: Top-level entity containing `id`, `goal`, `steps`, `status`, `version`, `createdAt`, `updatedAt`, `currentStepId`, and `metadata`.
* **`PlanStep`**: Step unit containing `id`, `title`, `description`, `status`, `dependencies`, `startedAt`, `completedAt`, and `error`.
* **`PlanState`**:
  * Manages state transitions:
    * Plan statuses: `draft` ➔ `ready` ➔ `in_progress` ➔ `completed` / `failed` / `cancelled` / `blocked`.
    * Step statuses: `pending` ➔ `in_progress` ➔ `completed` / `failed` / `skipped` / `blocked`.
  * Enforces terminal state immutability via `assertNotTerminal()`.
  * Resolves dependencies dynamically (`areDependenciesSatisfied()`). Steps with skipped dependencies treat those dependencies as satisfied.
  * Provides immutable deep-clone snapshots via `getSnapshot()`.
  * Supports runtime modification: adding steps (`addStep`) and updating step details (`updateStep`).

### 2.2 Validation & Cycle Detection (`PlanValidator`)

The `PlanValidator` enforces strict structural and graph constraints:
* **Limits**: Max steps (default: 20), max goal length (500 chars), max step title length (150 chars), max step description length (500 chars).
* **Identity**: Unique step IDs, non-empty goal and titles.
* **Graph Integrity**: All dependency IDs must reference existing steps in the plan.
* **Cycle Detection**: Employs a 3-color Depth-First Search (DFS) algorithm (`WHITE` = unvisited, `GRAY` = visiting, `BLACK` = finished) to detect both direct self-dependencies ($A \to A$), mutual cycles ($A \to B \to A$), and indirect cycles ($A \to B \to C \to A$), throwing `PlanDependencyError` if a cycle is found.

### 2.3 Planning Policy (`DefaultPlanningPolicy`)

Determines whether a user prompt requires formal planning or should execute directly:
* **Direct Execution Bypass**:
  * Informational queries: *"What is this file?"*, *"Explain how ConversationManager works"*.
  * Single-command queries: *"pwd"*, *"ls"*, *"run npm test"*.
* **Planning Triggers**:
  * Explicit triggers: *"Create a plan to..."*, *"Plan the migration of..."*.
  * Complex engineering verbs: `refactor`, `implement`, `migrate`, `migration`, `redesign`, `architecture`, `add feature`, `build`, `integrate`, `integration`, `restructure`, `rewrite`, `upgrade`.
  * Multi-sentence instructions on monorepo projects.
* **Plan-Only Fast Detection**:
  * Detects constraints like *"do not modify anything yet"*, *"plan only"*, *"no code changes"*. When triggered, `AgentRuntime` generates and formats the plan, records it in conversation, and completes without tool execution.

### 2.4 Plan Generator & Parser (`PlanGenerator`, `parsePlanResponse`)

* Builds a structured prompt injecting repository context (from `@ixia/context`) and user history.
* Requests `{ type: 'json_object' }` from LLM providers supporting structured output.
* Robust JSON extraction:
  1. Regex extraction from ` ```json ... ``` ` or ` ``` ... ``` ` markdown blocks.
  2. Fallback boundary search from first `{` to last `}`.
  3. JSON parsing and schema normalization.
* Runs parsed candidate through `PlanValidator` before returning.

### 2.5 Facade (`PlannerService`)

Exposes a clean developer API:
* `shouldPlan(input)`: Evaluates policy.
* `isPlanOnly(prompt)`: Checks plan-only intent.
* `generatePlan(input, provider, options)`: Generates validated plan.
* `createPlanState(plan)`: Initializes state machine.
* `formatPlanForDisplay(plan)`: Generates terminal-ready text representation.
* `formatPlanForPrompt(plan)`: Generates compact step tracking block injected into the LLM system prompt for the active step.

---

## 3. Terminal UI & Command Integration

* **Interactive UI Widget (`PlanView.tsx`)**:
  * Renders active plan goal and completion ratio (e.g. `(2/4 completed)`).
  * Visual status markers:
    * `✓` Completed (Green)
    * `→` In Progress / Active (Cyan)
    * `○` Pending (Dim / Slate)
    * `!` Blocked (Amber)
    * `×` Failed (Red)
    * `⊘` Skipped (Dim)
* **Slash Command (`/plan`)**:
  * Displays active plan status, current step, and roadmap directly in terminal history.
* **One-Shot Mode (`start.command.ts`)**:
  * Displays real-time step advancements: `📋 Generated Plan`, `▶ Step`, `✓ Step completed`.

---

## 4. Architectural Boundaries

To preserve architectural integrity, Phase 9 maintains strict boundaries:
* **No Second Agent Loop**: All tool calls remain managed by `AgentLoop`.
* **No File Editing Tools**: Modification tools are deferred to Phase 10+.
* **No Database Persistence**: Plans are ephemeral and exist in memory per session/run.
* **No Embeddings / Vector Stores**: Policy decisions are deterministic heuristics based on semantic triggers and context metadata.
