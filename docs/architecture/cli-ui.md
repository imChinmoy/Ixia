# CLI UI Architecture & Design System

The **Terminal User Interface (UI)** layer for Ixia (`@ixia/cli`) provides a dark, minimal, developer-focused terminal interface inspired by modern AI coding agents.

```text
                     apps/cli/src/ui/
                     ├── components/
                     │   ├── App.tsx             (App root wrapper)
                     │   ├── Header.tsx          (Minimal top header)
                     │   ├── Brand.tsx           (IXIA wordmark & tagline)
                     │   ├── Welcome.tsx         (Welcome message)
                     │   ├── QuickCommands.tsx   (Commands table)
                     │   ├── Capabilities.tsx    (Implemented capabilities)
                     │   ├── Divider.tsx         (Responsive divider line)
                     │   ├── Conversation.tsx    (Message stream & panels)
                     │   ├── UserMessage.tsx     (User prompt styling)
                     │   ├── AssistantMessage.tsx(Assistant response & markdown)
                     │   ├── InputPrompt.tsx     (Rounded bordered input)
                     │   ├── StatusBar.tsx       (Working dir & hints footer)
                     │   ├── Spinner.tsx         (Subtle thinking indicator)
                     │   ├── ToolsPanel.tsx      (Registered tools display)
                     │   └── HelpPanel.tsx       (Help commands display)
                     │
                     ├── screens/
                     │   └── InteractiveScreen.tsx (Main reactive orchestrator)
                     │
                     ├── layout/
                     │   └── terminal-layout.ts  (Terminal dimensions & breakpoints)
                     │
                     ├── theme/
                     │   └── theme.ts            (Color palette & chalk styles)
                     │
                     └── utils/
                         └── markdown.tsx        (Code blocks & syntax highlighter)
```

---

## 1. Design Principles

* **Minimal & Dark**: Near-black / charcoal aesthetic with soft white text, subtle slate borders, and zero gaudy gradients.
* **Developer-Focused**: Monospace typography, code block syntax highlighting, and clean negative space.
* **Ixia Visual Identity**: Recognizable `✦ S O R A` brand identity with an indigo (`#6366F1`) and cyan (`#38BDF8`) accent feel.
* **Non-intrusive**: Subtle thinking indicator, rounded unobtrusive borders, and quiet status hints.
* **Responsive & Resilient**: Dynamic adaptation to narrow (60–80 cols), standard (100–120 cols), and wide (160+ cols) terminal sizes, with height-aware element folding.

---

## 2. Theme System (`theme.ts`)

Colors are centralized in `apps/cli/src/ui/theme/theme.ts`:

| Role | Color | Hex Code | Description |
| :--- | :--- | :--- | :--- |
| **Primary** | Indigo Blue | `#6366F1` | Brand accents, active indicators, bullet points |
| **Purple** | Subtle Violet | `#8B5CF6` | Secondary brand treatment |
| **Secondary** | Muted Cyan | `#38BDF8` | User prompt `›`, command names (`/help`), language tags |
| **Text** | Soft White | `#F1F5F9` | High-readability primary body text |
| **Muted** | Medium Slate | `#64748B` | Descriptions, timestamps, secondary labels |
| **Dim** | Dark Slate | `#334155` | Box borders, horizontal dividers (`─`) |
| **BorderFocused** | Indigo | `#6366F1` | Active input prompt border |
| **Success** | Emerald Green | `#10B981` | Status dot (`●`), success messages |
| **Warning** | Amber | `#F59E0B` | Warnings, number syntax highlighting |
| **Error** | Coral Red | `#EF4444` | Error marks (`✗`), error diagnostics |

---

## 3. Responsive Layout & Breakpoints (`terminal-layout.ts`)

The interface reacts dynamically to terminal window resizing:

* **Breakpoints**:
  * `isNarrow` (`columns < 84`): Switches the two-column welcome panels (`QuickCommands` & `Capabilities`) to a single stacked column.
  * `isVeryNarrow` (`columns < 65`): Further truncates working directory paths in the status footer to prevent line-wrapping.
  * `isCompactHeight` (`rows < 26`): Automatically suppresses secondary decorative panels to guarantee the input prompt and footer remain on-screen.
  * `contentWidth`: Clamped between 20 and 120 columns to preserve comfortable line lengths on ultra-wide monitors.

---

## 4. Screen States & Transitions

### A. Fresh Session (Empty State)
When `messages.length === 0`:
1. **Header**: Centered `ixia — AI Coding Assistant`
2. **Brand**: High-impact, weighted pixel-art wordmark (`IXIA`), subtitle `AI CODING ASSISTANT`, tagline `Think. Build. Together.`, and version `v0.2.0`.
3. **Divider**: Subtle horizontal divider.
4. **Welcome**: Warm onboarding prompt.
5. **Quick Commands & Capabilities**: Side-by-side or stacked reference panels showing actual implemented capabilities (`Conversational AI`, `Filesystem Intelligence`, `Shell Execution`, `Developer Focused`).
6. **Input Area**: Rounded bordered box with placeholder `Type a message or /command...`.
7. **Status Bar**: Working directory, provider status `● Groq`, and key hints (`/help`, `Ctrl+C to exit`).

### B. Active Conversation State
When `messages.length > 0`:
1. The extensive welcome panels transition out cleanly.
2. A compact brand header (`✦ IXIA  AI CODING ASSISTANT  v0.2.0`) stays pinned at the top.
3. The conversation history occupies the central view:
   * **User Prompts**: Prefixed by cyan `›` with soft white text.
   * **Assistant Responses**: Prefixed by `✦ Ixia`, rendered with syntax-highlighted code blocks, lists, and headings.
4. If a response is generating, a subtle indicator (`✦ Ixia  ⠋ thinking...`) pulses.
5. Running `/clear` or `/new` resets the message array, instantly returning the interface to the clean welcome dashboard.

---

## 5. Input Prompt Design

The input prompt resides in a dedicated rounded container:

```text
╭────────────────────────────────────────────────────────────╮
│ › Type a message or /command..._                           │
╰────────────────────────────────────────────────────────────╯
```

* Active border: Uses `theme.primary` (`#6366F1`) during ready state.
* Disabled border: Uses `theme.dim` (`#334155`) while generating.
* Preserves raw mode, key navigation, backspace, and non-interactive piped stdin.

---

## 6. Supported Slash Commands

* `/help` — Formatted command reference table.
* `/tools` — Formatted list of all registered tools (`list_directory`, `read_file`, `search_files`, `file_info`, `execute_command`).
* `/cwd` — Displays current working directory.
* `/clear` & `/new` — Clears conversation history and returns to welcome dashboard.
* `/model` — Displays currently active model.
* `/config` — Displays runtime configuration (provider, model, cwd, version).
* `/status` — Displays session metrics (tools count, messages count, provider).
* `/exit` & `/quit` — Exits cleanly with graceful shutdown.
