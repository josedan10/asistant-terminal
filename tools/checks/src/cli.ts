import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkIgnorePolicy } from "./ignore-policy.ts";
import { checkNodeVersion } from "./node-version.ts";
import type { CheckResult } from "./result.ts";
import { checkTauriHardening, loadTauriInput } from "./tauri-hardening.ts";
import { checkWorkflows } from "./workflow-lint.ts";

type Check = (args: string[]) => CheckResult | Promise<CheckResult>;

const root = resolve(import.meta.dirname, "../../..");

const checks: Record<string, Check> = {
  "node-version": () =>
    checkNodeVersion(readFileSync(resolve(root, ".nvmrc"), "utf8"), process.versions.node),
  "tauri-hardening": () =>
    checkTauriHardening(
      loadTauriInput(
        resolve(root, "apps/desktop/src-tauri"),
        resolve(root, "tools/checks/policy/tauri-allowlist.json"),
      ),
    ),
  "workflow-lint": () =>
    checkWorkflows(
      resolve(root, ".github"),
      JSON.parse(readFileSync(resolve(root, "tools/checks/policy/workflows.json"), "utf8")),
    ),
  "ignore-policy": () => checkIgnorePolicy(root),
};

export function register(name: string, check: Check): void {
  checks[name] = check;
}

export async function run(argv: string[], log: (line: string) => void): Promise<number> {
  const [name, ...args] = argv;
  const check = name ? checks[name] : undefined;
  if (!check) {
    log(`usage: checks <${Object.keys(checks).join("|")}> [args]`);
    return 2;
  }
  const r = await check(args);
  for (const v of r.violations) log(`✗ ${v}`);
  if (r.ok) log(`✓ ${name}`);
  return r.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await run(process.argv.slice(2), (l) => console.log(l));
}
