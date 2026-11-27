# Roadmap

Priority: **supervise → operate → work remotely → keep it light**. Security and lean context run through every phase.
See `docs/COMMAND_CENTER.md` (desktop), `docs/REMOTE_AND_MOBILE.md` (sync, mobile, backlog), `docs/CONTEXT_OPTIMIZATION.md`, `docs/MCP_GATEWAY.md`, `docs/SECURITY.md`, `docs/USAGE_MONITORING.md` and `docs/TECH_STACK.md`.
Each phase ends with something usable and the memory benchmark passing.

## Phase 0 – Foundation & integration spikes

- Monorepo per `TECH_STACK.md`; toolchain: rustup (Rust stable), Node 24 LTS, pnpm, just, lefthook
- Scaffold Tauri 2 + React + TS + Vite (see `TAURI_SETUP.md`)
- Memory/perf benchmark harness (RSS, frame time) in CI from day one
- **Spikes (time-boxed, a written note for each):** for Claude Code, Codex, Cursor CLI, Gemini CLI,
  Junie, Antigravity and Ollama, document the headless/JSON mode, subagent visibility, approval
  handling, usage reporting and pinned version. Decide each agent's adapter tier.
- Security baseline: CI scanners (OSV-Scanner, cargo-deny, Semgrep, gitleaks), Dependabot, Tauri hardening defaults, threat model v1
- Spikes also fill in the usage capability matrix (tokens, cost, plan-window %/reset per agent)
- Spikes also cover the context tools (Serena, Context7): maintenance, license, memory use, per-session MCP config
- Exit: empty app under the idle memory budget; adapter matrix filled in; security CI green

## Phase 1 – Core daemon (`jarvisd`, Rust)

- Runs as a background service (launchd/systemd); the desktop UI connects over local IPC
- Session Manager + state machine; PTY host with ring buffers (portable-pty)
- Normalized `AgentEvent` bus; SQLite store (WAL); process-tree resource monitor
- Usage tables + incremental rollups; versioned price table
- Keeps the computer awake while agents run
- Generic PTY adapter (tier 2), so any CLI can run supervised
- Clean agent environment (allowlisted env vars) + policy engine skeleton
- Exit: sessions survive closing the UI; events persist; budget holds

## Phase 2 – First structured adapters

- Claude Code adapter (structured output + hooks for subagents)
- Codex adapter
- Usage events (tokens, cache, cost, plan info where exposed) + log-parser fallback
- Context Broker v1: shared ignore lists + MCP config injection (Serena, Context7) per adapter
- Exit: both report tool calls, subagents and usage in the normalized model

## Phase 3 – Mission Control UI (desktop MVP: use it daily from here)

- Board of agent cards (with live tokens/cost), agent → subagent tree, session timeline
- Plans panel: plan-window gauges with reset countdown and source badges
- Terminal attach/detach (mounted only while visible); batched streaming; virtualized lists
- Exit: 10 concurrent sessions visible and smooth; memory targets met

## Phase 4 – Operate & supervise (desktop)

- Approvals inbox enforced by the policy engine (not the model); command allowlists; reply/send input, stop/kill/restart
- New-session launcher with a git worktree per agent
- ⌘K command bar, OS notifications
- Exit: a full day of agent work runs without dropping to another terminal

## Phase 5 – Accounts & sync service

- Sync backend (managed, e.g. Supabase): OAuth + MFA, device registry, QR device pairing
- Daemon sync client: outbound WSS, throttled session snapshots, offline buffer and replay
- Commands channel (approve/deny/reply/stop) with an audit log
- Project registry (which projects a computer allows remote tasks for)
- ASVS L2 controls, RLS tests, rate limiting
- Exit: a second client can see live snapshots and send commands securely

## Phase 6 – Task backlog & autonomous runner

- Task model + backlog in the cloud; leases with heartbeat
- Task Runner in `jarvisd`: claim → worktree/branch → dispatch (rule-based) → monitor → push branch / open PR → `review`
- Autonomy levels (`supervised` / `auto_safe` / `full`), budgets (USD, tokens, time), timeouts, global kill switch
- Token usage rolled up per task (all sessions + subagents); usage alerts; defer tasks when an agent's plan window is ≥ 90%
- Context Packs per task (repo map + candidate files + decisions) and the jarvis MCP
- OS sandbox + network egress allowlist for unattended tasks; prompt-injection fixture suite in CI
- Security Watch layer 2 (AI advisory watch) runs as a recurring backlog task
- Backlog view on desktop
- Exit: tasks queued while away get done and wait in `review`, without anyone at the keyboard

## Phase 7 – Mobile app (Expo / React Native)

- Login + pairing, Home (computers, "needs you", kill switch), Backlog (add/reorder/voice), Active, Approvals, Review, Task detail
- Plans panel + per-task usage
- Push notifications: needs approval, failed, ready for review, plan near limit
- OWASP MASVS review
- Exit: a full day managed from the phone only

## Phase 8 – External MCP gateway (ChatGPT, Claude & other assistants)

- Local MCP server in `jarvisd` (stdio/localhost): projects, outline, code search/read (opt-in, redacted), tasks, decisions
- Remote MCP endpoint on the sync service with OAuth 2.1, per-client scopes, revocation, rate limits, audit log
- `create_task` lands as needing confirmation; no approvals, shell or autonomy changes over MCP
- Exit: from a Claude or ChatGPT chat, browse a project and queue a task that your computer runs after one-tap confirmation

## Phase 9 – More agents

- Cursor CLI, Gemini CLI, Junie, local models (Ollama / llama.cpp via an open harness)
- Observe-only adapter (logs/OTel/hooks) for IDE-bound agents such as Antigravity and for sessions started outside the app
- MCP allowlist/pinning and context injection for each new adapter
- Exit: every agent in the matrix shows up on the board and is selectable for backlog tasks at its tier

## Phase 10 – Orchestrator

- Break one goal into subtasks across agents (rules first, model-assisted later); writes child tasks into the backlog
- Routing by task type, cost, remaining plan capacity and agent availability; user override always available
- Cross-agent progress roll-up on board and mobile

## Phase 11 – Instruction improver + Decision & Amendment Memory

- Free/local model improves rough instructions (including ones from the phone) before dispatch
- Human-in-the-loop review step (desktop or mobile)
- Capture amendments and decisions (user-confirmed only, against memory poisoning); feed them into Context Packs; sync via the service
- Context-efficiency metrics (tokens per task, cache hits) on the board drive tuning

## Phase 12 – Polish

- Editor pane (CodeMirror 6), git UI (diffs, PRs), drag & drop, highlight-to-context, theming

## Later

- End-to-end encryption of synced content
- Multiple worker computers with capability-based task routing
- Optional local semantic code index (`RAG_MODULE.md`), embeddings for memory retrieval
- Container sandbox option for agents
- Cost budgets and alerts per project
