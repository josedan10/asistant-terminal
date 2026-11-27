import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTauriHardening, loadTauriInput, type TauriInput } from "../src/tauri-hardening.ts";

const root = resolve(import.meta.dirname, "../../..");
const real = () =>
  loadTauriInput(
    resolve(root, "apps/desktop/src-tauri"),
    resolve(root, "tools/checks/policy/tauri-allowlist.json"),
  );
const mutate = (fn: (i: TauriInput) => void) => {
  const i = structuredClone(real());
  fn(i);
  return checkTauriHardening(i);
};
const expectViolation = (r: ReturnType<typeof checkTauriHardening>, re: RegExp) => {
  expect(r.ok).toBe(false);
  expect(r.violations.some((v) => re.test(v))).toBe(true);
};

describe("tauri-hardening", () => {
  it("passes on the real desktop config", () => {
    const r = checkTauriHardening(real());
    expect(r.violations).toEqual([]);
  });

  it("fails when the CSP is missing", () => {
    expectViolation(
      mutate((i) => (i.conf.app.security.csp = null)),
      /CSP must be set/,
    );
  });

  it("fails on unsafe-eval in script-src", () => {
    expectViolation(
      mutate((i) => (i.conf.app.security.csp["script-src"] = "'self' 'unsafe-eval'")),
      /unsafe-eval/,
    );
  });

  it("fails on a string CSP that allows remote scripts", () => {
    expectViolation(
      mutate(
        (i) =>
          (i.conf.app.security.csp = "default-src 'self'; script-src https:; object-src 'none'"),
      ),
      /must not allow https:/,
    );
  });

  it("fails when connect-src allows the network", () => {
    expectViolation(
      mutate((i) => (i.conf.app.security.csp["connect-src"] = "ipc: https://evil.example")),
      /connect-src/,
    );
  });

  it("fails on a remote devUrl", () => {
    expectViolation(
      mutate((i) => (i.conf.build.devUrl = "https://example.com")),
      /devUrl/,
    );
  });

  it("fails on a window loading a remote URL", () => {
    expectViolation(
      mutate((i) => (i.conf.app.windows[0].url = "https://example.com")),
      /remote URL/,
    );
  });

  it("fails on a capability outside the allowlist", () => {
    expectViolation(
      mutate((i) => i.capabilities[0].permissions.push("shell:allow-execute")),
      /shell:allow-execute/,
    );
  });

  it("fails on a capability granting remote access", () => {
    expectViolation(
      mutate((i) => (i.capabilities[0].remote = { urls: ["https://*"] })),
      /remote URLs/,
    );
  });

  it("fails when the devtools feature is enabled", () => {
    expectViolation(
      mutate(
        (i) => (i.cargoToml = i.cargoToml.replace("features = []", 'features = ["devtools"]')),
      ),
      /devtools/,
    );
  });

  it("fails when global Tauri is exposed", () => {
    expectViolation(
      mutate((i) => (i.conf.app.withGlobalTauri = true)),
      /withGlobalTauri/,
    );
  });
});
