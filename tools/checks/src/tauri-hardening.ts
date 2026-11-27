import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type CheckResult, result } from "./result.ts";

export interface TauriInput {
  conf: any;
  capabilities: any[];
  cargoToml: string;
  allowedPermissions: string[];
}

const UNSAFE_SCRIPT = [
  "'unsafe-eval'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  "*",
  "http:",
  "https:",
];
const ALLOWED_CONNECT = new Set(["ipc:", "http://ipc.localhost"]);

function cspDirectives(csp: unknown): Record<string, string[]> | null {
  if (!csp) return null;
  const entries: [string, string][] =
    typeof csp === "string"
      ? csp
          .split(";")
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            const [k, ...v] = d.split(/\s+/);
            return [k as string, v.join(" ")];
          })
      : Object.entries(csp as Record<string, string | string[]>).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(" ") : v,
        ]);
  return Object.fromEntries(entries.map(([k, v]) => [k, v.split(/\s+/).filter(Boolean)]));
}

function isLocal(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function checkTauriHardening(input: TauriInput): CheckResult {
  const v: string[] = [];
  const { conf } = input;
  const security = conf?.app?.security ?? {};

  const csp = cspDirectives(security.csp);
  if (!csp) {
    v.push("CSP must be set (app.security.csp is null/missing)");
  } else {
    if (!csp["default-src"]) v.push("CSP must define default-src");
    const script = csp["script-src"] ?? csp["default-src"] ?? [];
    for (const bad of UNSAFE_SCRIPT) {
      if (script.includes(bad)) v.push(`CSP script-src must not allow ${bad}`);
    }
    for (const src of csp["connect-src"] ?? []) {
      if (!ALLOWED_CONNECT.has(src)) v.push(`CSP connect-src must only allow IPC (found ${src})`);
    }
    if (!csp["object-src"]?.includes("'none'")) v.push("CSP object-src must be 'none'");
  }
  if (security.dangerousDisableAssetCspModification) {
    v.push("dangerousDisableAssetCspModification must not be set");
  }
  if (conf?.app?.withGlobalTauri) v.push("withGlobalTauri must be false");

  const devUrl = conf?.build?.devUrl;
  if (devUrl && !isLocal(devUrl)) v.push(`build.devUrl must be localhost (found ${devUrl})`);
  for (const w of conf?.app?.windows ?? []) {
    if (typeof w.url === "string" && /^https?:/.test(w.url)) {
      v.push(`window "${w.label ?? "?"}" must not load a remote URL (${w.url})`);
    }
    if (w.devtools === true) v.push(`window "${w.label ?? "?"}" must not force-enable devtools`);
  }
  if (/features\s*=\s*\[[^\]]*"devtools"/.test(input.cargoToml)) {
    v.push('tauri "devtools" feature must not be enabled (would ship devtools in release)');
  }

  const allowed = new Set(input.allowedPermissions);
  for (const cap of input.capabilities) {
    if (cap.remote) v.push(`capability "${cap.identifier}" must not grant remote URLs`);
    for (const p of cap.permissions ?? []) {
      const id = typeof p === "string" ? p : p.identifier;
      if (!allowed.has(id)) {
        v.push(
          `capability "${cap.identifier}" requests "${id}", which is not in policy/tauri-allowlist.json`,
        );
      }
    }
  }
  return result(v);
}

export function loadTauriInput(srcTauri: string, allowlistPath: string): TauriInput {
  const capDir = join(srcTauri, "capabilities");
  return {
    conf: JSON.parse(readFileSync(join(srcTauri, "tauri.conf.json"), "utf8")),
    capabilities: readdirSync(capDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(capDir, f), "utf8"))),
    cargoToml: readFileSync(join(srcTauri, "Cargo.toml"), "utf8"),
    allowedPermissions: JSON.parse(readFileSync(allowlistPath, "utf8")).permissions,
  };
}
