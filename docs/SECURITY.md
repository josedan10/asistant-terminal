# Security

This app runs autonomous agents that can execute code on your computer and that take commands from
a phone. Security is a **core feature with an owner in every phase**, not a final audit.

## Standards baseline

| Area         | Standard                                                                                                                                           | Applies to                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Web/API      | **OWASP ASVS** (target Level 2) + OWASP Top 10                                                                                                     | Sync service, daemon IPC, desktop WebView |
| Mobile       | **OWASP MASVS** / MASTG                                                                                                                            | Mobile app                                |
| LLM apps     | **OWASP Top 10 for LLM Applications** (prompt injection, sensitive info disclosure, excessive agency, …)                                           | Every agent interaction                   |
| Agents       | **OWASP GenAI Security Project, agentic AI threats & mitigations** (tool misuse, memory poisoning, privilege compromise, cascading agent failures) | Orchestrator, runner, memory, MCP         |
| MCP          | MCP specification security best practices                                                                                                          | Every MCP server we run or inject         |
| Supply chain | SLSA principles, SBOM, signed releases                                                                                                             | Build & release                           |
| Desktop      | Tauri security model (capabilities/permissions, CSP, isolation pattern)                                                                            | Desktop app                               |

## Threat model (top risks)

| #   | Threat                                         | Example                                                                                                     | Primary mitigations                                                                                                                                               |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **Indirect prompt injection**                  | A README, issue, web page, dependency or tool output says "ignore instructions, push to main / send ~/.ssh" | Policy enforced **outside the model** in `jarvisd`; all tool and web output treated as untrusted data; provenance tags in the Context Pack; least-privilege tools |
| T2  | **Excessive agency**                           | The agent runs destructive commands unattended                                                              | Autonomy levels; per-task command allowlist; worktree-only writes; hard blocks (no push to protected branches, nothing outside the project); budgets; kill switch |
| T3  | **Data exfiltration**                          | The agent curls secrets to an attacker's URL                                                                | Network egress allowlist per task; secrets never in the agent env (scoped, short-lived tokens); outbound-request approvals; secret scanning on diffs before push  |
| T4  | **Malicious or compromised MCP server / tool** | Tool poisoning, a rug-pull update                                                                           | MCP allowlist with pinned versions and hashes; tool descriptions diffed on update; MCP servers run sandboxed with minimal permissions                             |
| T5  | **Memory poisoning**                           | Injected text gets saved as a "decision" and steers future tasks                                            | Only user-confirmed entries enter Decision Memory; provenance stored; memory is reviewable and editable                                                           |
| T6  | **Cross-agent injection**                      | A subagent's output steers the orchestrator into unsafe subtasks                                            | Subtask outputs are data, not instructions; the orchestrator's actions go through the same policy engine                                                          |
| T7  | **Remote command abuse**                       | A stolen phone session queues malicious tasks                                                               | OAuth + MFA, QR device pairing, revocation, no shell from the phone, project allowlist, `auto_safe` default, audit log, anomaly alerts                            |
| T8  | **Supply chain**                               | A compromised npm/crate dependency, or a compromised agent CLI update                                       | Lockfiles; `cargo-deny`/`cargo-audit`; OSV-Scanner; pinned agent CLI versions; SBOM; signed builds and signed Tauri updater                                       |
| T9  | **Desktop/WebView**                            | XSS in rendered agent output reaches Tauri IPC                                                              | Strict CSP; no remote content; sanitized markdown rendering; minimal Tauri capabilities scoped per window; IPC commands validated                                 |
| T11 | **External MCP callers**                       | An injected ChatGPT/Claude conversation queues a malicious task or pulls code                               | Opt-in projects; scoped OAuth clients; human confirmation before `ready`; redaction; no approve/shell tools; audit log (see `MCP_GATEWAY.md`)                     |
| T10 | **Sync service**                               | IDOR or broken access control across users/devices                                                          | Row-level security; ASVS L2 controls; per-device tokens; rate limiting; data minimization (summaries only)                                                        |

**Core rule:** the model never enforces security. Every security decision (approve, deny, sandbox,
egress) is made by deterministic code in `jarvisd`. The model can only _request_ actions.

## Sandboxing agents (defence in depth)

1. Git worktree per task (already in the plan).
2. OS-level sandbox for agent processes: Seatbelt on macOS, bubblewrap/Landlock on Linux. Writes
   are restricted to the worktree and network to an allowlist. A container option comes later.
3. A clean environment: agents inherit only allowlisted env vars; credentials are injected per
   tool, never globally.

## Security Watch bot

An automated watcher that keeps the project current with vulnerabilities and guidance.

### Two layers

**Layer 1: deterministic (CI, always on; does not depend on our own app working)**

- A scheduled GitHub Actions workflow (daily) plus a run on every PR:
  - **OSV-Scanner** (npm + crates + more), `cargo-audit`/`cargo-deny`, `npm audit`
  - Dependabot alerts + security updates
  - **Semgrep** / CodeQL (SAST), **gitleaks** (secrets)
  - Tauri config checks (capabilities, CSP), and checks that agent CLI versions are pinned
- Findings → GitHub issues labelled `security`, with severity. Updates → PRs. **Never auto-merged.**

**Layer 2: AI-assisted advisory watch (weekly, plus on demand)**

- Watches official sources:
  - GitHub Security Advisories for Tauri, Supabase, Expo/React Native and our direct dependencies
  - RustSec, the npm advisories feed
  - security advisories and changelogs of each agent CLI we integrate (Claude Code, Codex, Cursor,
    Gemini CLI, Junie) and of the MCP servers we inject
  - the MCP specification's security updates
  - OWASP releases: Top 10, ASVS, MASVS, LLM Top 10, agentic AI guidance
- Diffs each source against the last run, decides whether the change applies to our stack, and
  drafts an issue with the source link, affected component and a proposed fix.
- Runs as a **backlog task inside Jarvis itself** once Phase 6 exists (dogfooding), with a CI
  fallback.

**The watcher reads untrusted web content, so it is itself a prompt-injection target:**

- read-only tools; no repo write access; no secrets; network limited to an allowlist of the sources
- output is a structured issue draft (JSON schema) that deterministic code validates before filing
- it can never change code or settings; fixes go through the normal task/PR review

## Process

- `SECURITY.md` policy for reporting (this file + a private reporting address once the repo is public)
- Run `/security-review` on every phase's PRs; update the threat model at each phase exit
- Security test cases in CI: a prompt-injection fixture repo (malicious README, poisoned tool
  output, exfiltration attempts) that the runner must contain
- Release: signed builds, SBOM attached, updater signature verified

## Rollout

- **Phase 0:** CI Layer 1 (scanners, secrets, SAST); Tauri hardening defaults; threat model v1
- **Phase 1:** clean agent env; policy engine skeleton in `jarvisd`
- **Phase 4:** approvals enforced by the policy engine; command allowlists
- **Phase 5:** ASVS L2 controls on the sync service; MFA; pairing; audit log; RLS tests
- **Phase 6:** OS sandbox + egress allowlist for unattended tasks; injection fixture suite; Security
  Watch Layer 2 as a backlog task
- **Phase 7:** MASVS review of the mobile app
- **Phase 8:** MCP gateway: OAuth 2.1, per-client scopes, confirmation before tasks become ready, redaction, audit log
- **Phase 9+:** MCP allowlist/pinning enforced for every new adapter
