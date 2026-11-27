# Usage Monitoring: tokens per task & plan limits

## Goal

- **Token usage per task:** input, output, cache and reasoning tokens, plus cost, rolled up across
  every agent session and subagent that worked on a task.
- **Plan usage, where available:** how much of each subscription's window is used (for example
  Claude's 5-hour and weekly limits, Codex plan limits, Cursor monthly usage, Gemini daily quota)
  and when it resets.
- Use both to **warn** you, and to **schedule** backlog work so it doesn't stall on a used-up plan.

Not every agent exposes all of this. Every number carries its **source**, so the UI never presents
an estimate as fact.

## Data sources (best first)

| # | Source | Gives | Notes |
|---|--------|-------|-------|
| 1 | **Agent event stream** (tier-1 adapters) | Per-turn/session tokens, often cost; sometimes rate-limit / plan-window info | Most accurate and real-time |
| 2 | **Agent local session logs** (e.g. Claude Code and Codex keep JSONL transcripts in the user's home directory) | Per-message tokens and model, including sessions started outside Jarvis | Read-only parsing; formats change, so pin by agent version |
| 3 | **Agent status commands** (e.g. a `/status`- or `/usage`-style view) | Plan window % and reset time | Only if they can be queried non-interactively; 🔬 spike |
| 4 | **Provider usage APIs** (Anthropic and OpenAI admin/usage APIs) | Authoritative spend for **API-key** billing | Not available for subscription plans; needs admin keys (stored in the keychain) |
| 5 | **Estimation** | Cost from tokens × a versioned price table; plan % from tokens in the rolling window ÷ the known plan limit | Always labelled `estimated` |

What each agent exposes is captured in the **Phase 0 spikes** and recorded as a usage capability
matrix in `docs/spikes/ADAPTER_MATRIX.md`:

| Agent | Tokens per session | Cost | Plan window % / reset | Source |
|-------|-------------------|------|----------------------|--------|
| Claude Code | 🔬 | 🔬 | 🔬 | events / transcripts / status |
| Codex | 🔬 | 🔬 | 🔬 | events / session logs |
| Cursor | 🔬 | 🔬 | 🔬 | events / dashboard only? |
| Gemini CLI | 🔬 | 🔬 | 🔬 | stream-json stats |
| Junie | 🔬 | 🔬 | 🔬 | — |
| opencode + Ollama (local) | 🔬 | $0 (local) | n/a | events / Ollama counts |
| Antigravity | 🔬 | 🔬 | 🔬 | observe only |

## Data model (extends `jarvis-protocol`)

```ts
type UsageSource = "reported" | "parsed_log" | "provider_api" | "estimated";

// emitted per turn by adapters; replaces the simple v0 usage event
interface UsageEvent {
  type: "usage";
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  costSource?: UsageSource;
}

interface PlanUsageSnapshot {
  provider: "anthropic" | "openai" | "cursor" | "google" | "jetbrains" | "local";
  account: string;              // a label, never credentials
  plan?: string;                // e.g. "Max", "Pro", "Plus", "Business"
  window: "5h" | "daily" | "weekly" | "monthly";
  usedPct?: number;
  used?: number; limit?: number; unit?: "tokens" | "requests" | "usd";
  resetsAt?: number;
  source: UsageSource;
  observedAt: number;
}
```

**Storage:** usage rows in SQLite are tied to `sessionId`, so task totals include subagents
through the session tree. Plan snapshots form a small time series. **Rollups** are by task,
project, agent, model and day. They are computed incrementally, so the UI never sums raw rows.

## Where it shows up

- **Agent card:** live tokens (in/out/cache), cost, and a cache-hit ratio. This shares data with
  the context-efficiency metrics in `CONTEXT_OPTIMIZATION.md`.
- **Task card/detail:** the task total across all sessions and subagents, with a breakdown by
  agent and by model, and the budget used (tokens and USD).
- **Plans panel** (desktop + mobile home): one gauge per plan window with % used, reset countdown,
  and a source badge (reported/estimated).
- **Reports:** per day, project and agent; tokens per completed task; most expensive tasks.
- **Alerts:** plan window at 80% and 95%; a task at 80% of its budget; unusual burn rate (for
  example a looping agent).

## Usage-aware scheduling (Task Runner / Orchestrator)

- Task budgets gain **`maxTokens`** alongside `maxUsd` and `maxMinutes`. Exceeding any of them
  stops the task (state `failed: budget`).
- Before claiming a task for an agent, the runner checks that agent's plan windows. If one is at
  ≥ 90%, it routes to another eligible agent (Phase 10 orchestrator) or **defers until `resetsAt`**
  and shows "waiting for plan reset" on the phone.
- Local models are the fallback for low-risk tasks when every paid plan is near its limit, if
  you've enabled that.

## Privacy & security
- Usage data is metadata; only aggregates and plan snapshots sync to the cloud.
- Admin API keys for provider usage APIs live in the OS keychain, read-only scope only.
- Parsing local agent logs is read-only and only reads usage fields. Transcript content is never
  loaded into memory beyond what parsing needs, and is never synced.

## Rollout
- **Phase 0:** spikes fill in the usage capability matrix; `jarvis-protocol` v0 includes
  `UsageEvent` + `PlanUsageSnapshot`.
- **Phase 1:** usage tables + incremental rollups in the store; versioned price table.
- **Phase 2:** the Claude Code and Codex adapters emit usage (and plan info where exposed); log
  parsers as a fallback.
- **Phase 3:** usage on agent cards; plans panel on desktop.
- **Phase 6:** task rollups, `maxTokens` budgets, alerts, plan-aware deferral.
- **Phase 7:** plans panel + task usage on mobile; push alerts.
- **Phase 8:** a `get_usage` tool on the MCP gateway (read-only).
- **Phase 10:** the orchestrator routes using remaining plan capacity and cost.
