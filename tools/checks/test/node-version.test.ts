import { describe, expect, it } from "vitest";
import { checkNodeVersion } from "../src/node-version.ts";

describe("node-version", () => {
  it("passes when majors match", () => {
    expect(checkNodeVersion("24", "24.22.3").ok).toBe(true);
  });

  it("accepts a v-prefixed .nvmrc with whitespace", () => {
    expect(checkNodeVersion("v24\n", "24.1.0").ok).toBe(true);
  });

  it("fails with a message naming the required version", () => {
    const r = checkNodeVersion("24", "23.1.0");
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toContain("Node 24");
    expect(r.violations[0]).toContain("23.1.0");
  });

  it("fails on an unparseable .nvmrc", () => {
    expect(checkNodeVersion("lts/*", "24.0.0").ok).toBe(false);
  });
});
