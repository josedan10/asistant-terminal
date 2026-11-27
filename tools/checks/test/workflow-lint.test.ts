import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { checkWorkflows, lintDependabot, lintWorkflow, type Policy } from "../src/workflow-lint.ts";

const root = resolve(import.meta.dirname, "../../..");
const policy: Policy = JSON.parse(
  readFileSync(resolve(root, "tools/checks/policy/workflows.json"), "utf8"),
);
const load = (f: string) => parse(readFileSync(resolve(root, ".github/workflows", f), "utf8"));
const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

describe("workflow-lint", () => {
  it("passes on the real workflows and dependabot config", () => {
    expect(checkWorkflows(resolve(root, ".github"), policy).violations).toEqual([]);
  });

  it("rejects an action pinned to a tag", () => {
    const wf = load("ci.yml");
    wf.jobs.ts.steps[0].uses = "actions/checkout@v7";
    expect(lintWorkflow("ci.yml", wf, policy.workflows["ci.yml"])).toContainEqual(
      expect.stringMatching(/actions\/checkout@v7.*not pinned/),
    );
  });

  it("rejects a short SHA", () => {
    const v = lintWorkflow("x.yml", {
      permissions: {},
      jobs: { a: { steps: [{ uses: `actions/checkout@${SHA.slice(0, 7)}` }] } },
    });
    expect(v.join()).toMatch(/not pinned/);
  });

  it("allows local actions and full SHAs", () => {
    const v = lintWorkflow("x.yml", {
      permissions: {},
      jobs: { a: { steps: [{ uses: "./.github/actions/x" }, { uses: `o/r/sub@${SHA}` }] } },
    });
    expect(v).toEqual([]);
  });

  it("requires a permissions block", () => {
    const wf = load("security.yml");
    delete wf.permissions;
    expect(lintWorkflow("security.yml", wf).join()).toMatch(/permissions/);
  });

  it("detects a missing scanner job", () => {
    const wf = load("security.yml");
    delete wf.jobs.semgrep;
    expect(lintWorkflow("security.yml", wf, policy.workflows["security.yml"]).join()).toMatch(
      /missing required job "semgrep"/,
    );
  });

  it("detects a dropped OS from the matrix", () => {
    const wf = load("ci.yml");
    wf.jobs.rust.strategy.matrix.os = ["ubuntu-latest"];
    expect(lintWorkflow("ci.yml", wf, policy.workflows["ci.yml"]).join()).toMatch(
      /"rust" must run on macos-latest/,
    );
  });

  it("detects a missing schedule trigger", () => {
    const wf = load("security.yml");
    delete wf.on.schedule;
    expect(lintWorkflow("security.yml", wf, policy.workflows["security.yml"]).join()).toMatch(
      /missing trigger "schedule"/,
    );
  });

  it("detects a missing dependabot ecosystem", () => {
    expect(
      lintDependabot({ updates: [{ "package-ecosystem": "npm" }] }, policy.dependabotEcosystems),
    ).toHaveLength(2);
  });
});
