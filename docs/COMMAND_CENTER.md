# Command Center ("Jarvis") — Product & Architecture

## Vision

This is a terminal built to supervise agents. From one window you can launch, watch, steer and stop
coding agents (Claude Code, Codex, Cursor, Gemini/Antigravity, Junie and local models) and their
subagents. You see what each one is doing and what it needs from you.

The three pillars, in priority order:

1. **Supervision.** A live view of every agent and subagent: status, current step, tool calls,
   tokens/cost and pending approvals.
2. **Operation.** Start, pause, stop, reply to, approve or redirect any agent without leaving the
   app. Fall back to its raw terminal at any time.
3. **Low memory use.** The app must stay light with many agents running. Memory is a design
   constraint with a budget, not a cleanup task for the end.

The existing ideas (instruction improver, Decision & Amendment Memory, GitHub sync) stay in the
plan. They build on top of the command center and come later.

## Architecture

```text
┌──────────────────────── WebView (React + TS) ─────────────────────────┐
│ Mission Control board │ Agent tree │ Timeline │ Approvals │ Terminals │
│   (renders snapshots + batched deltas; terminals mounted only if visible)│
└───────────────▲───────────────────────────────────────┬───────────────┘
                │ Tauri events (batched, ~10/s max)     │ commands
┌───────────────┴───────────────────────────────────────▼───────────────┐
│                       Rust core (Tauri backend)                        │
│  Session Manager ── state machine per agent/subagent                   │
│  Event Bus ──────── normalized AgentEvent stream                       │
│  PTY Host ───────── portable-pty, ring-buffered output per session     │
│  Store ──────────── SQLite (WAL): sessions, events, usage, approvals   │
│  Resource Monitor ─ RSS/CPU per child process tree                     │
│  Adapters ───────── one per agent kind (see below)                     │
└───────────────┬──────────────┬──────────────┬─────────────────────────┘
                │              │              │
          structured      PTY + parse     observe-only
        (JSON / ACP)     (fallback)     (logs, OTel, hooks)
                │              │              │
     claude, codex, cursor,  any CLI      IDE-bound agents
     gemini, local models                 (e.g. Antigravity)
```

**Rule:** Rust owns all state and all bytes. The WebView only gets what it is displaying.

The Rust core runs as a background daemon, **`jarvisd`**. The Tauri app connects to it over local IPC,
so agents and the task backlog keep running with the window closed. The daemon also syncs with the
cloud service so the mobile app works. See `REMOTE_AND_MOBILE.md`.

## Agent integration: adapter tiers

Every adapter emits the same `AgentEvent` stream, so the UI never knows which agent it is showing.

| Tier | How | Fidelity | Use for |
|------|-----|----------|---------|
| 1. Structured | Agent's machine-readable mode (stream-JSON, `exec --json`, Agent Client Protocol, SDK) | Full: steps, tool calls, subagents, usage, approvals | Claude Code, Codex, Cursor CLI, Gemini CLI, local models |
| 2. PTY | Run the interactive CLI in a PTY and infer state with heuristics (idle, prompt, spinner) | Partial: status and raw output | Any CLI without a structured mode (Junie until verified, custom tools) |
| 3. Observe | Watch log files, hooks or OpenTelemetry exports from agents started elsewhere | Read-only | IDE-bound agents (Antigravity, Cursor IDE), sessions started outside the app |

An adapter can combine tiers. For example, Claude Code can run structured while also sending hook
and OTel events so that subagent starts and stops are captured.

> ⚠️ Each agent's exact headless flags, JSON schema and subagent visibility must be checked
> in Phase 0 (integration spikes) before an adapter is built. CLIs change fast, so pin versions.

**Local models:** Ollama, llama.cpp or LM Studio through their OpenAI-compatible endpoint. They need
an agent loop, so either (a) run them inside an existing open harness that has a JSON or ACP mode,
or (b) build a minimal loop in the core later. Start with (a).

## Normalized event model

```ts
type AgentKind = "claude" | "codex" | "cursor" | "gemini" | "antigravity" | "junie" | "local" | "generic";

type SessionState =
  | "queued" | "running" | "waiting_input" | "needs_approval"
  | "paused" | "done" | "failed" | "stopped";

interface AgentEvent {
  sessionId: string;
  parentId?: string;        // subagent → parent session (builds the tree)
  agent: AgentKind;
  ts: number;
  kind:
    | { type: "started"; cwd: string; model?: string; task?: string }
    | { type: "state"; state: SessionState }
    | { type: "message"; role: "assistant" | "user"; text: string }
    | { type: "tool_call"; id: string; name: string; summary: string }
    | { type: "tool_result"; id: string; ok: boolean }
    | { type: "approval_request"; id: string; action: string; risk?: "low" | "high" }
    | { type: "subagent_spawned"; childId: string; task: string }
    | { type: "progress"; step?: string; pct?: number }
    | { type: "usage"; model?: string; inputTokens: number; outputTokens: number;
        cacheReadTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number;
        costUsd?: number; costSource?: "reported" | "parsed_log" | "provider_api" | "estimated" }
    // plan-window usage is a separate PlanUsageSnapshot; see USAGE_MONITORING.md
    | { type: "error"; message: string }
    | { type: "finished"; summary?: string };
}
```

The UI subscribes to **session snapshots** (current state, current step, counters) plus a capped
tail of recent events. It does not subscribe to the full history.

## Memory budget

Targets to enforce with a benchmark harness from Phase 0 onward:

| Metric | Target |
|--------|--------|
| App idle, no agents | < 120 MB RSS (app + WebView) |
| Per additional supervised session (app side, excluding the agent's own process) | < 10 MB |
| 10 sessions, 1 terminal visible | < 250 MB RSS |
| UI frame time while 10 agents stream | < 16 ms p95 |

Techniques:

- **Terminals are views, not owners.** PTY output goes into a bounded ring buffer in Rust (for
  example 5k lines). An xterm.js instance exists only while its pane is visible. When it opens, it
  replays from the buffer, and it is disposed when hidden. Use the WebGL renderer only for the
  focused terminal, since browsers limit the number of WebGL contexts.
- **Batch the UI updates.** Rust merges events and sends at most about 10 updates per second per
  view. React keeps them in an external store and selects narrowly (see the `react-realtime-ui`
  skill).
- **Virtualize** the agent list and the timeline.
- **Store the full history on disk**, not in memory. Events go to SQLite and the UI pages them in
  on demand. Old events are compacted and old sessions are pruned.
- **Monitor the agents' own resource use:** per-process-tree RSS and CPU. Show it on each card and
  warn when an agent grows past a threshold, because agent CLIs (Node and Python) are usually the
  biggest memory cost.
- **No Electron, no bundled Chromium.** Tauri uses the system WebView.

## UI surfaces

1. **Mission Control board.** One card per root agent: agent kind, task, state badge, current step,
   elapsed time, tokens/cost, RSS, and a count of pending approvals. Cards can be grouped by project
   or worktree.
2. **Agent tree.** Shows the agent → subagent hierarchy with a state for each node.
3. **Session detail.** Timeline of messages and tool calls, a diff and file-touch list, and a
   button to attach the raw terminal.
4. **Approvals inbox.** All permission requests from every agent in one queue, with
   approve/deny/edit and keyboard-first handling.
5. **Command bar (⌘K).** "new claude in ~/x worktree y: …", "stop all", "reply to codex-2: …".
6. **Notifications.** Native OS notifications for needs-approval, finished or failed.

## Control actions

Start (agent, cwd, optional new git worktree, task), reply or send input, approve or deny,
pause/resume where the agent supports it, stop (SIGINT then SIGTERM), kill the process tree,
restart with the same task, and open the session in a terminal.

## Open questions

- Should sessions started *outside* the app (for example `claude` in another terminal) be
  first-class (needs hooks or OTel ingest), or should only app-launched agents be supported at
  first? **Recommendation:** app-launched first, with observe-only as an add-on.
- Should approvals be routed through the app, by putting the agent in a mode where it asks the host,
  or left in the agent's own TUI? This depends on what each agent's headless mode supports, so the
  spikes decide it.
- Remote and mobile control is now part of the plan; see `REMOTE_AND_MOBILE.md`.
