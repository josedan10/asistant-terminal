import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkIgnorePolicy,
  denyIgnores,
  gitleaksIgnores,
  osvIgnores,
  semgrepIgnores,
} from "../src/ignore-policy.ts";

const root = resolve(import.meta.dirname, "../../..");

describe("ignore-policy", () => {
  it("passes on the real scanner configs", () => {
    expect(checkIgnorePolicy(root).violations).toEqual([]);
  });

  it("deny: bare string ignore fails", () => {
    expect(denyIgnores('[advisories]\nignore = ["RUSTSEC-2020-0071"]')).toHaveLength(1);
  });

  it("deny: reason without review-by fails, with review-by passes", () => {
    const bad = '[advisories]\nignore = [{ id = "X", reason = "no fix yet" }]';
    const good =
      '[advisories]\nignore = [{ id = "X", reason = "no fix yet; review-by: 2027-01-01" }]';
    expect(denyIgnores(bad)).toHaveLength(1);
    expect(denyIgnores(good)).toEqual([]);
  });

  it("osv: needs reason and ignoreUntil", () => {
    expect(osvIgnores('[[IgnoredVulns]]\nid = "GHSA-x"')).toHaveLength(2);
    expect(
      osvIgnores('[[IgnoredVulns]]\nid = "GHSA-x"\nreason = "dev-only"\nignoreUntil = 2027-01-01'),
    ).toEqual([]);
  });

  it("gitleaks: allowlist without review-by fails", () => {
    expect(gitleaksIgnores('[[allowlists]]\ndescription = "fixtures"\npaths = ["x"]')).toHaveLength(
      1,
    );
    expect(
      gitleaksIgnores(
        '[[allowlists]]\ndescription = "fixtures; review-by: 2027-01-01"\npaths = ["x"]',
      ),
    ).toEqual([]);
  });

  it("semgrep: unjustified pattern fails", () => {
    expect(semgrepIgnores("dist/\n")).toHaveLength(1);
    expect(semgrepIgnores("# reason: build output. review-by: 2027-01-01\ndist/\n")).toEqual([]);
    // a justification covers only the next pattern
    expect(semgrepIgnores("# reason: x review-by: 2027-01-01\na/\nb/\n")).toHaveLength(1);
  });
});
