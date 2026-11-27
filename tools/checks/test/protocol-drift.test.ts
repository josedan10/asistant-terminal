import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const GEN = "packages/protocol/src/generated";

/** The drift-detection commands of the `gen-check` recipe (everything after regeneration). */
function genCheckCommands(): string[] {
  const justfile = readFileSync(join(root, "justfile"), "utf8");
  const body = justfile.split(/^gen-check:.*$/m)[1]?.split(/^\S/m)[0] ?? "";
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

let dir = "";
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

function repoWithGenerated(): string {
  dir = mkdtempSync(join(tmpdir(), "jarvis-drift-"));
  // Isolate from the user's global git config (signing, hooks) so the test is fast and deterministic.
  const git = (...a: string[]) =>
    execFileSync(
      "git",
      ["-C", dir, "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...a],
      { stdio: "pipe", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } },
    );
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  mkdirSync(join(dir, GEN), { recursive: true });
  writeFileSync(join(dir, GEN, "AgentKind.ts"), 'export type AgentKind = "claude";\n');
  git("add", ".");
  git("commit", "-qm", "init");
  return dir;
}

const runAll = (cwd: string) => {
  for (const cmd of genCheckCommands()) {
    const r = spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf8" });
    if (r.status !== 0) return { ok: false, out: r.stdout + r.stderr };
  }
  return { ok: true, out: "" };
};

describe("protocol drift check (gen-check recipe)", () => {
  it("has detection commands after regeneration", () => {
    expect(genCheckCommands().some((c) => c.includes(GEN))).toBe(true);
  });

  it("passes when generated files match the committed ones", () => {
    expect(runAll(repoWithGenerated()).ok).toBe(true);
  });

  it("fails and names the file when a generated type changed", () => {
    const d = repoWithGenerated();
    writeFileSync(join(d, GEN, "AgentKind.ts"), 'export type AgentKind = "claude" | "codex";\n');
    const r = runAll(d);
    expect(r.ok).toBe(false);
    expect(r.out).toContain("AgentKind.ts");
  });

  it("fails when a new generated file is not committed", () => {
    const d = repoWithGenerated();
    writeFileSync(join(d, GEN, "NewType.ts"), "export type NewType = 1;\n");
    expect(runAll(d).ok).toBe(false);
  });
});
