import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";

describe("cli", () => {
  it("rejects an unknown check with usage", async () => {
    const out: string[] = [];
    const code = await run(["nope"], (l) => out.push(l));
    expect(code).not.toBe(0);
    expect(out.join("\n")).toMatch(/usage/i);
  });

  it("rejects no arguments", async () => {
    expect(await run([], () => {})).not.toBe(0);
  });
});
