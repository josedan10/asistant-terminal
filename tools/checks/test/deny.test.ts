import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const hasDeny = spawnSync("cargo", ["deny", "--version"]).status === 0;
const run = !hasDeny && !process.env.REQUIRE_TOOLS ? it.skip : it;

/** Run cargo-deny with the repo's real deny.toml against a copied fixture workspace. */
function denyFixture(name: string, check: "advisories" | "licenses") {
  const dir = mkdtempSync(join(tmpdir(), `jarvis-deny-${name}-`));
  try {
    cpSync(join(import.meta.dirname, "fixtures/deny", name), dir, { recursive: true });
    cpSync(join(root, "deny.toml"), join(dir, "deny.toml")); // the real policy under test
    return spawnSync(
      "cargo",
      ["deny", "--manifest-path", join(dir, "Cargo.toml"), "check", check],
      { encoding: "utf8", timeout: 240_000 },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("deny.toml policy", () => {
  run("fails on a dependency with a known advisory", { timeout: 300_000 }, () => {
    const r = denyFixture("vulnerable", "advisories");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/RUSTSEC-2020-0071/);
  });

  run("fails on a license outside the allowlist", { timeout: 300_000 }, () => {
    const r = denyFixture("bad-license", "licenses");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/GPL-3\.0/);
  });
});
