import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "../../..");
const hasGitleaks = spawnSync("gitleaks", ["version"]).status === 0;
const lefthook = parse(readFileSync(join(root, "lefthook.yml"), "utf8"));
const gitleaksCmd: string = lefthook["pre-commit"].commands.gitleaks.run;

// Build a key-shaped string at runtime so no secret-like literal lives in the repo.
const fakeAwsKey = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let id = "AKIA";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

describe("pre-commit hook", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-hook-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("runs gitleaks on staged changes", () => {
    expect(gitleaksCmd).toMatch(/^gitleaks git --staged/);
  });

  it.skipIf(!hasGitleaks && !process.env.REQUIRE_TOOLS)("rejects a staged secret", () => {
    execFileSync("git", ["init", "-q", dir]);
    writeFileSync(join(dir, "config.env"), `AWS_ACCESS_KEY_ID=${fakeAwsKey()}\n`);
    execFileSync("git", ["-C", dir, "add", "."]);
    const [bin, ...args] = gitleaksCmd.split(" ");
    const r = spawnSync(bin as string, args, { cwd: dir });
    expect(r.status).not.toBe(0);
  });

  it.skipIf(!hasGitleaks && !process.env.REQUIRE_TOOLS)("allows clean staged changes", () => {
    const clean = mkdtempSync(join(tmpdir(), "jarvis-hook-clean-"));
    execFileSync("git", ["init", "-q", clean]);
    writeFileSync(join(clean, "readme.md"), "hello\n");
    execFileSync("git", ["-C", clean, "add", "."]);
    const [bin, ...args] = gitleaksCmd.split(" ");
    const r = spawnSync(bin as string, args, { cwd: clean });
    rmSync(clean, { recursive: true, force: true });
    expect(r.status).toBe(0);
  });
});
