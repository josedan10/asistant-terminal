# Tech Stack

The decided stack for every part of Jarvis. Versions are the latest stable releases checked on
**2026-11-27** (npm and crates.io); pin exact versions in lockfiles. Items marked 🔬 must be
confirmed by a Phase 0 spike before we depend on them.

Selection rules: **low memory first**, one language per layer, official SDKs over community ones,
and every dependency must pass `cargo-deny` / OSV.

## Repo layout (monorepo)

```text
asistant-terminal/
├── crates/
│   ├── jarvisd/          # background daemon: sessions, PTY, store, runner, policy, sync client, MCP
│   ├── jarvis-protocol/  # shared types (AgentEvent, Task, Command…) → exported to TS via ts-rs
│   ├── jarvis-adapters/  # one module per agent kind + fixture-based tests
│   ├── jarvis-context/   # Context Broker: tree-sitter repo map, packs, ignore rules
│   └── jarvis-relay/     # cloud relay service: daemon WSS, remote MCP endpoint
├── apps/
│   ├── desktop/          # Tauri 2 shell + React UI (an IPC client of jarvisd)
│   └── mobile/           # Expo / React Native app
├── packages/
│   ├── protocol/         # generated TS types + zod schemas for untrusted boundaries
│   └── ui-core/          # shared TS logic (stores, formatters) for desktop and mobile
├── supabase/             # migrations, RLS policies, edge functions (push)
├── docs/
└── justfile              # task runner entry point
```

## Toolchain

| Tool | Choice | Notes |
|------|--------|-------|
| Rust | stable, edition 2024, Cargo workspace | Installed (1.100) |
| Node | **24 LTS** (via nvm, pinned in `.nvmrc`) | Installed (24.22) |
| JS package manager | **pnpm** workspaces | Already installed |
| Task runner | **just** | One `just dev`, `just test`, `just bench`, `just audit` |
| Python | **uv** (only to run Serena) | Already installed |
| Git hooks | **lefthook** | fmt, lint, gitleaks on commit |
| Commits | Conventional Commits | Changelogs later |

## Daemon & core (Rust): `jarvisd`

| Concern | Crate | Version | Why |
|---------|-------|---------|-----|
| Async runtime | `tokio` | 1.54 | Standard |
| PTY | `portable-pty` | 0.9 | From WezTerm, cross-platform. Stable but rarely updated, so it is wrapped behind our own trait |
| Local IPC | `interprocess` | 2.4 | Unix sockets and Windows named pipes; JSON-RPC 2.0 framing over it |
| Storage | `rusqlite` (bundled, WAL) + `rusqlite_migration` | 0.43 / 2.9 | Lighter than an async ORM; one writer thread |
| Serialization | `serde`, `serde_json` | latest | |
| Type export to TS | `ts-rs` | 12.0 | Rust structs are the single source of truth for the protocol |
| MCP (server and client) | **`rmcp`** (official Rust MCP SDK) | 3.12 | Internal jarvis MCP + external gateway (stdio, Streamable HTTP) |
| Process/resource stats | `sysinfo` | 0.40 | RSS/CPU per process tree |
| Keep awake | `keepawake` | 0.6 | Cross-platform sleep inhibition while tasks run |
| Run as a service | `service-manager` | 0.11 | launchd / systemd / Windows service install |
| Secrets | `keyring` | 4.2 | OS keychain for device and sync tokens |
| WebSocket client | `tokio-tungstenite` (rustls) | 0.30 | Outbound connection to the relay |
| HTTP client | `reqwest` (rustls) | latest | |
| Repo map | `tree-sitter` + grammar crates | 0.27 | Context Packs |
| Git | `git` CLI (worktrees, push) + `gix` for fast reads | — | The CLI is the most reliable for worktrees |
| File watching | `notify` | latest | Observe-only adapter, config reloads |
| Sandbox (Linux) | `landlock` | 0.4 | Plus `bubblewrap` when present |
| Sandbox (macOS) | Seatbelt profiles (`sandbox-exec`) | — | 🔬 Same approach Codex and Claude Code use; verify on macOS 26 |
| OTLP receiver | `opentelemetry-proto` + `axum` | — | Ingest agents' OTel (observe tier) |
| Logging | `tracing` + `tracing-subscriber` | latest | JSON logs, rotated |
| Errors | `thiserror` (libs) / `anyhow` (bins) | latest | |

## Desktop UI: `apps/desktop`

| Concern | Package | Version | Why |
|---------|---------|---------|-----|
| Shell | **Tauri 2** (`@tauri-apps/cli`, `@tauri-apps/api`) | 2.12 | System WebView, small RSS. Capabilities locked down |
| UI | **React 19** + **TypeScript** | 19.3 / 7.0 | |
| Build | **Vite** | 8.4 | |
| State | **Zustand** (external store, narrow selectors) | 5.1 | Fits batched streaming (`react-realtime-ui` skill) |
| Virtualization | `@tanstack/react-virtual` | 3.14 | Agent lists, timelines |
| Terminal | `@xterm/xterm` + `addon-fit`, `addon-webgl` (focused pane only), `addon-serialize` | 6.0 | Mounted only while visible |
| Layout | `react-resizable-panels` | 4.25 | |
| Editor / diffs | CodeMirror 6 (`@codemirror/*`, `@codemirror/merge`) | latest | Phase 12; diffs earlier |
| Styling | **Tailwind CSS v4** + Radix primitives (shadcn/ui pattern) | 4.3 | Copy-in components, no heavy kit |
| Command bar | `cmdk` | 1.1 | ⌘K |
| Icons | `lucide-react` | latest | Tree-shaken |
| Markdown (agent output) | `react-markdown` + **`rehype-sanitize`** | latest | XSS guard (threat T9) |
| Validation | `zod` | latest | At untrusted boundaries only |

## Mobile: `apps/mobile`

| Concern | Package | Version |
|---------|---------|---------|
| Framework | **Expo** (SDK 58) + React Native + TypeScript | 58.1 |
| Navigation | Expo Router | bundled with the SDK |
| Data | `@supabase/supabase-js` + TanStack Query; Zustand for UI state | 2.119 |
| Lists | `@shopify/flash-list` | 2.3 |
| Push | `expo-notifications` (Expo Push → APNs/FCM) | SDK |
| Secure storage | `expo-secure-store` | SDK |
| Biometric approve | `expo-local-authentication` | SDK |
| QR pairing | `expo-camera` | SDK |
| Voice task capture | OS dictation first; on-device speech later | — |

## Cloud

| Piece | Choice | Why |
|-------|--------|-----|
| Auth, DB, realtime | **Supabase** (Postgres + Auth with MFA + Realtime + RLS) | Mobile uses it directly; RLS enforces per-user isolation |
| Relay service | **`jarvis-relay`**: Rust, `axum` 0.8 + `tokio-tungstenite` + `rmcp`, on **Fly.io** | Long-lived WSS to daemons, which serverless can't hold; hosts the remote MCP endpoint; same language as the daemon |
| DB access from relay | `sqlx` (Postgres) | Validates Supabase JWTs, writes snapshots/commands |
| Push sender | Supabase Edge Function → Expo Push API | |
| Remote MCP auth | OAuth 2.1 per the MCP authorization spec | 🔬 Decide between Supabase Auth as the authorization server and a dedicated one |

## Agent integrations (adapters)

| Agent | Interface | Tier | Status |
|-------|-----------|------|--------|
| Claude Code | `claude -p --output-format stream-json` + hooks (subagent start/stop) + OTel | 1 | 🔬 |
| Codex | `codex exec --json` (also app-server / MCP-server modes) | 1 | 🔬 |
| Cursor | `cursor-agent -p --output-format stream-json` | 1 | 🔬 |
| Gemini CLI | stream-JSON output or ACP | 1 | 🔬 |
| Junie | Junie CLI if it has a headless mode, otherwise PTY | 1–2 | 🔬 |
| Antigravity | Logs / OTel / file watching (IDE-bound) | 3 | 🔬 |
| Local models | **Ollama** as the model server. Harness: **Codex `--oss`** (reuses the Codex adapter) or **opencode** | 1 | 🔬 |
| Any other CLI | Generic PTY adapter | 2 | — |

**ACP (Agent Client Protocol)** is evaluated in the spikes as a possible single tier-1 interface
for several agents.

## Context layer

| Piece | Choice | Notes |
|-------|--------|-------|
| Code navigation MCP | **Serena** (run with `uvx`) | 🔬 Uses language servers, which can be **memory-heavy** (rust-analyzer). Start them lazily per project, shut them down when idle, and count them in the RSS monitor |
| Library docs MCP | **Context7** | 🔬 Remote or `npx`; pin the version |
| Repo map | Our own (`jarvis-context`, tree-sitter) | |
| Semantic index (later) | `sqlite-vec` + small local embedding model through Ollama | Only if needed |

## Testing & quality

| Layer | Tools |
|-------|-------|
| Rust | `cargo-nextest`, **`insta`** 1.49 (snapshot tests of adapter parsing against recorded agent JSON streams), `proptest` for parsers, `clippy` (deny warnings), `rustfmt` |
| TS | **Biome** 2.6 (lint + format), **Vitest** 5.1 + Testing Library |
| Desktop E2E | Playwright against the web build with mocked IPC; `tauri-driver` on Linux CI |
| Mobile E2E | Maestro |
| Performance | `criterion` microbenchmarks + our RSS / frame-time harness (`just bench`), with CI budgets from `COMMAND_CENTER.md` |
| Security fixtures | Prompt-injection fixture repo run against the runner in CI |

## Security tooling (see `SECURITY.md`)

`cargo-deny` + `cargo-audit`, **OSV-Scanner**, Dependabot, **Semgrep** + CodeQL, **gitleaks**,
**zizmor** (GitHub Actions hardening), `syft` (SBOM), Tauri updater signing, macOS notarization.

## CI/CD
- GitHub Actions: matrix of macOS / Linux (Windows later). Jobs: fmt+lint, test, bench budgets,
  security scans, build.
- Releases: Tauri bundler (signed, notarized) + Tauri updater; EAS Build/Submit for mobile; Fly
  deploy for the relay; Supabase migrations through the CLI.

## Claude Code skills for building this repo

| Skill | Use when |
|-------|----------|
| `sdd-*` (explore → propose → spec → design → tasks → apply → verify → archive) | Every phase / change |
| `react-realtime-ui` | Wiring the event stream into React |
| `browser-automation` | Checking the UI renders (web build) |
| `agent-suite-setup` | Creating `AGENTS.md`, routing and MCP parity, since several agents will work on this repo |
| `claude-api` | Anything touching the Claude API/SDK (Claude Code adapter, model choice) |
| `security-review`, `code-review` | Every phase's pull requests |
| `dataviz` | Usage/cost/RSS charts on the board |

**Project skills to write** (in `.claude/skills/`, mirrored for the other agents):
- `jarvis-adapter`: how to add an agent adapter (record fixtures → snapshot tests → tier mapping)
- `jarvis-perf`: memory-budget rules and how to run `just bench`
- `jarvis-security`: threat-model checklist (T1–T11) for any change touching policy, sync, MCP or adapters

## Rejected alternatives (and why)
- **Electron**: bundles Chromium, so 3–5× the memory.
- **Bundling Node or Python in the daemon**: extra memory; external tools run as children only when needed.
- **sqlx in the daemon**: async overhead with no benefit for a local single-writer SQLite.
- **Redux / heavy UI kits**: more re-render and bundle cost than Zustand + Radix.
- **Serverless-only cloud**: can't hold the daemon's long-lived WebSocket.
- **Tauri mobile instead of Expo**: younger ecosystem for push, camera and biometrics.
