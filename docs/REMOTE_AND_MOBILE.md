# Remote Control, Mobile App & Task Backlog

## Goal

From your phone you can:

- see live progress for every agent and task running on your computer(s)
- add tasks to a **backlog** that the computer's orchestrator picks up and works through on its own,
  even when you are away from the computer
- approve or deny actions, reply to agents, stop or kill them, and get push notifications

The computer is the **worker**. The phone is a **remote control**. A cloud **sync service** connects
the two, so the computer only ever makes outbound connections: no open ports and no VPN needed.

## Topology

```text
   📱 Mobile app                    ☁️  Sync service                     💻 Computer (worker)
 ┌──────────────┐   HTTPS/WSS   ┌────────────────────┐   WSS (outbound)  ┌──────────────────────┐
 │ Task backlog  │──────────────▶│ Auth (OAuth + MFA) │◀──────────────────│ jarvisd (daemon)     │
 │ Board/progress│◀──────────────│ Devices registry   │──────────────────▶│  • Session Manager    │
 │ Approvals     │   realtime    │ Tasks (backlog)    │  task claims,     │  • Task Runner        │
 │ Push notifs   │               │ Session snapshots  │  commands         │  • Adapters / PTY     │
 └──────────────┘               │ Commands queue     │                   │  • SQLite (local truth│
                                 │ Push (APNs/FCM)    │                   │  • Sync client        │
                                 └────────────────────┘                   └─────────▲────────────┘
                                                                                    │ local IPC
                                                                          ┌─────────┴────────────┐
                                                                          │ Tauri desktop UI      │
                                                                          └──────────────────────┘
```

### Key architectural change: split daemon and UI

The Rust core becomes a background daemon, **`jarvisd`** (launchd on macOS, systemd user service
on Linux, Windows service later). The Tauri app is just one client of it, connecting over local IPC
(Unix socket or named pipe).

- Agents keep running and the backlog keeps moving when the desktop window is closed.
- Closing the UI frees all WebView memory. Only the lean daemon stays resident, which helps the
  memory budget.
- While tasks are running, the daemon keeps the computer awake (on macOS, an IOPMAssertion, the
  same mechanism `caffeinate` uses). It releases that when idle.

## Sync model

**The computer's SQLite store is the source of truth for sessions. The cloud stores the backlog
and lightweight snapshots.**

| Data                                                                                     | Owner    | Synced to cloud                                                   |
| ---------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| Tasks (backlog)                                                                          | Cloud    | — (phone and computer both read/write)                            |
| Session snapshots: state, current step, progress, usage, RSS, last N events (summarized) | Computer | Yes, throttled (≤ 1 update/s per session)                         |
| Approval requests                                                                        | Computer | Yes (must reach the phone)                                        |
| Commands (approve, reply, stop, new task)                                                | Phone    | Yes → delivered to the computer                                   |
| Full event history, raw terminal output, diffs                                           | Computer | **No by default**; fetched on demand while the computer is online |
| Devices, presence ("last seen")                                                          | Cloud    | —                                                                 |

The computer buffers outgoing updates locally and replays them after reconnecting. The phone shows
"computer offline, last seen 14:02", and tasks stay in the backlog until a worker comes back.

## Task backlog

```ts
type TaskStatus =
  | "backlog" // captured, not ready
  | "ready" // can be picked up
  | "claimed" // a worker holds the lease
  | "running"
  | "needs_approval" // blocked on you
  | "review" // finished, PR/branch ready for you
  | "done"
  | "failed"
  | "cancelled";

interface Task {
  id: string;
  title: string;
  description: string; // the instruction (later: run through the improver, Phase 11)
  projectId: string; // a project registered by a computer (repo → local path stays on device)
  preferredAgent?: AgentKind; // or let the dispatcher choose
  priority: 1 | 2 | 3 | 4;
  autonomy: "supervised" | "auto_safe" | "full";
  budget: { maxUsd?: number; maxTokens?: number; maxMinutes?: number };
  dependsOn?: string[];
  status: TaskStatus;
  claimedBy?: string; // deviceId
  leaseExpiresAt?: number; // renewed by heartbeat; expired lease → back to "ready"
  sessionIds: string[]; // agent sessions created for this task
  result?: { summary: string; branch?: string; prUrl?: string };
  createdAt: number;
  updatedAt: number;
}
```

### Pickup loop (Task Runner in `jarvisd`)

1. Have a free slot? (Concurrency limit per computer, for example 3 agents, plus a memory and CPU
   headroom check.)
2. Atomically claim the highest-priority `ready` task whose dependencies are done, for a project
   that exists on this computer. Take a lease and renew it with heartbeats.
3. Create a **git worktree and branch per task** (`jarvis/<task-id>`). Never work on the main branch.
4. Dispatch to an agent: the preferred agent if set, otherwise rule-based routing. The full
   multi-agent orchestrator comes later and replaces this step.
5. Stream progress to the cloud. On an approval request, apply the task's autonomy policy (below)
   or push a notification to the phone and wait.
6. When finished: commit, push the branch, optionally open a PR, then set the status to `review`
   with a summary. You review and merge; the agent never merges.
7. If the budget is exceeded, the task stalls past a timeout, or the process crashes, stop the
   agent, set `failed` with the reason and notify you.

If the computer disconnects mid-task, the lease expires. The task resumes on the same computer when
it reconnects (preferred), or another of your computers may pick it up.

### Autonomy policy (unattended safety)

| Level        | Behaviour                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supervised` | Every approval request goes to your phone; the agent waits                                                                                                                                   |
| `auto_safe`  | Auto-approve reads, edits inside the worktree, tests and linters; anything else (network, installs, deletes outside the worktree, git push to protected branches, secrets) goes to the phone |
| `full`       | Auto-approve everything inside the worktree sandbox; still hard-blocked: pushing to main, operations outside the project, credential access                                                  |

Hard limits that apply to every level:

- cost and time budgets for each task
- a global kill switch on the phone ("stop everything")
- one worktree per task, never the main checkout

## Security

The phone can cause code execution on your computer, so this boundary must be tight.

- **Login:** OAuth (GitHub/Google) with MFA required. The phone and computer use the same account.
- **Device pairing:** a new computer or phone is approved by scanning a QR code shown on an
  already-trusted device. Devices can be revoked.
- **Limited command surface:** the phone can create tasks, approve or deny, reply, stop or kill,
  and change priority. **No arbitrary shell from the phone.** A remote raw terminal, if ever added,
  is a separate explicit opt-in.
- **Project allowlist:** tasks can only target projects the computer explicitly registered.
- **Data minimization:** the cloud gets summaries and snapshots by default. Full output and diffs
  stream peer-through-relay only while viewing, and are not stored.
- **Optional end-to-end encryption** (later): each device has a key pair, and the content of
  snapshots and commands is encrypted so the cloud only sees routing metadata.
- **Audit log** of every remote command (who, which device, when), visible in both apps.

## Technology choices (recommendations)

| Piece        | Recommendation                                                                                                  | Why                                                                                     | Alternative                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sync service | Managed backend with auth, Postgres, realtime and row-level security (for example Supabase)                     | Login, realtime and per-user data isolation come built in; fastest to an MVP            | Small custom Rust/TS relay (more control, more work); Tailscale peer-to-peer (no cloud, but no offline backlog) |
| Mobile app   | React Native + Expo                                                                                             | Shares TypeScript types and logic with the desktop React app; mature push notifications | Tauri 2 mobile (one stack, younger ecosystem); a PWA first (fastest, weaker push on iOS)                        |
| Push         | Expo Push → APNs/FCM                                                                                            | One API for iOS and Android                                                             | Direct APNs/FCM                                                                                                 |
| Shared code  | `packages/protocol` (event model, Task, commands as TS types + zod schemas; Rust structs generated or mirrored) | One contract across daemon, desktop, mobile and cloud                                   | —                                                                                                               |

## Mobile app screens

1. **Home:** computers (online/offline, active agents, RSS/CPU), plan usage gauges (see `USAGE_MONITORING.md`), the "needs you" count and a kill switch.
2. **Backlog:** add a task (title, project, agent, priority, autonomy, budget), reorder by
   drag-and-drop, quick-add with voice dictation.
3. **Active:** task cards showing their agent → subagent tree, state, current step, elapsed time and cost.
4. **Approvals:** swipe to approve or deny, with the risk level and the exact action shown.
5. **Review:** finished tasks with a summary and branch/PR link, and buttons to re-run or send back
   with feedback.
6. **Task detail:** timeline (summarized), and a "load full log" button that works only while the
   computer is online.

## Open questions

- Do you plan to have more than one worker computer? The lease design supports it; the question is
  only how much UI work multi-worker gets.
- Hosting: managed backend (recommended) or self-hosted from the start?
- Default autonomy for tasks created on the phone: `auto_safe` is recommended.
