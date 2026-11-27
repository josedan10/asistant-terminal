# External MCP Gateway: use Jarvis from ChatGPT, Claude and other assistants

## Goal

Expose the command center as an **MCP server**, so any MCP-capable assistant (Claude desktop or
web, ChatGPT, Cursor, Gemini, and others) can:
- browse your registered projects through scoped, read-only retrieval
- check tasks, agents and progress
- add tasks to the backlog for your computer to work on
- read and propose decisions for Decision & Amendment Memory

For example, in a ChatGPT or Claude conversation you could say: *"Look at how auth works in
find-pitch and queue a task for Claude Code to add rate limiting."*

This is the same command surface the phone uses, offered through a standard protocol.

## Two deployment modes

```text
 Local clients (same computer)                     Remote clients (web/mobile chat apps)
 Claude desktop, Cursor, Codex, …                  claude.ai, ChatGPT, …
        │ stdio / localhost HTTP                           │ HTTPS (Streamable HTTP) + OAuth 2.1
        ▼                                                  ▼
 ┌───────────────┐                              ┌──────────────────────────┐
 │ jarvisd MCP   │◀──── same tools/policy ─────▶│ Sync service MCP endpoint │
 │ (local)       │                              │ (cloud, relays to daemon) │
 └───────────────┘                              └────────────┬─────────────┘
                                                             │ existing outbound WSS
                                                             ▼
                                                        jarvisd (computer)
```

- **Local:** `jarvisd` serves MCP over stdio or a localhost-only port. It needs no cloud.
- **Remote:** web chat apps can only reach public HTTPS endpoints, so the **sync service** hosts the
  MCP endpoint and relays calls to the computer over the connection that already exists.
  Authentication uses the MCP authorization flow (OAuth 2.1), so each assistant connects as a
  separately authorized, revocable client.

> This is distinct from the **internal** jarvis MCP in `CONTEXT_OPTIMIZATION.md`, which serves the
> agents *we* launch. The two share code but have different tool sets and trust levels.

## Tools

| Tool | Scope | Notes |
|------|-------|-------|
| `list_projects` | `read` | Only projects you opted in as "exposed to external assistants" |
| `get_project_outline` | `read` | Repo map from the Context Broker, not raw dumps |
| `search_code`, `get_symbol`, `read_file` | `read:code` | Ignore lists apply; secret redaction; size limits; per-project opt-in |
| `list_tasks`, `get_task` | `read` | Status, summary, branch/PR link |
| `get_session_summary` | `read` | Summarized timeline, never raw terminal output |
| `get_decisions` | `read` | From Decision Memory |
| `get_usage` | `read` | Task/project token totals and plan-window snapshots |
| `create_task` | `write:tasks` | Lands as **`backlog` (needs your confirmation)**, never directly `ready` |
| `comment_on_task` | `write:tasks` | Adds context to an existing task |
| `propose_decision` | `write:memory` | Pending until you confirm it, which protects against memory poisoning |
| `stop_task` | `control` | Stopping is safe to allow; off by default |

**Never exposed:** approving agent actions, running shell commands, raising autonomy levels,
editing files directly, managing devices, or reading raw logs or secrets. Those stay on the
desktop or phone, where you act directly.

## Security

An external assistant is an **untrusted caller**. Its conversation may contain injected content,
for example from a web page it just browsed.

- **Human confirmation boundary:** anything that leads to code execution (a new task) needs your
  one-tap confirmation on the phone or desktop before it becomes `ready`. Settings can loosen this
  for trusted local clients only.
- **Per-client scopes:** each connected assistant gets its own OAuth client and scopes (for
  example ChatGPT `read` only, Claude desktop `read` + `write:tasks`). Clients can be revoked at any time.
- **Data leaving your machine:** anything returned to a remote assistant goes to that provider.
  Projects are opt-in, code reads are redacted for secrets and limited by ignore lists, and every
  read is shown in the audit log.
- **Tasks from MCP carry provenance** (`source: mcp:<client>`). They default to `supervised`
  autonomy, and their descriptions are treated as untrusted input by the runner.
- **Tool descriptions are kept stable and minimal.** Changes go through review, since connecting
  clients see them as instructions.
- Rate limits for each client, and everything goes through the same deterministic policy engine
  as the phone.
- Covered by the threat model in `SECURITY.md`: T1 (injection), T3 (exfiltration), T5 (memory
  poisoning), T7 (remote abuse).

## Rollout
- **Phase 8:** local MCP server in `jarvisd` (read tools + `create_task` with confirmation); then
  the remote endpoint on the sync service with OAuth 2.1, per-client scopes and the audit log.
  Verify it against Claude (desktop and web) and ChatGPT, whose connector support and limits need
  checking at the time.
- **Later:** MCP resources and prompts (for example a "plan a feature in project X" prompt), and
  notifications back to the assistant when a task reaches `review`.
