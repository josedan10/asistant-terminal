import { describe, expect, it } from "vitest";
import type {
  AgentEvent,
  EventKind,
  PlanUsageSnapshot,
  SessionState,
  UsageEvent,
} from "../src/index";

// Compile-time coverage: `pnpm typecheck` fails if the generated types drift from this usage.
const usage: UsageEvent = {
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 100,
  costUsd: 0.01,
  costSource: "reported",
};

const kinds: EventKind[] = [
  { type: "started", cwd: "/repo" },
  { type: "state", state: "needs_approval" },
  { type: "message", role: "assistant", text: "hi" },
  { type: "tool_call", id: "t1", name: "bash", summary: "ls" },
  { type: "tool_result", id: "t1", ok: true },
  { type: "approval_request", id: "a1", action: "rm", risk: "high" },
  { type: "subagent_spawned", childId: "s2", task: "explore" },
  { type: "progress", pct: 50 },
  { type: "usage", ...usage },
  { type: "error", message: "x" },
  { type: "finished" },
];

const plan: PlanUsageSnapshot = {
  provider: "anthropic",
  account: "personal",
  window: "5h",
  usedPct: 40,
  source: "estimated",
  observedAt: 1,
};

describe("generated protocol types", () => {
  it("cover every event kind", () => {
    const events: AgentEvent[] = kinds.map((kind) => ({
      sessionId: "s1",
      agent: "claude",
      ts: 1,
      kind,
    }));
    expect(new Set(events.map((e) => e.kind.type)).size).toBe(11);
  });

  it("accept the Rust wire format", () => {
    const wire = JSON.parse(
      '{"sessionId":"s1","parentId":"p0","agent":"codex","ts":1,"kind":{"type":"usage","inputTokens":1,"outputTokens":2}}',
    ) as AgentEvent;
    expect(wire.kind.type).toBe("usage");
    const state: SessionState = "waiting_input";
    expect([plan.window, state]).toEqual(["5h", "waiting_input"]);
  });
});
