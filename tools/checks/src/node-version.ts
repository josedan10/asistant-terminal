import { type CheckResult, result } from "./result.ts";

/** Compare the major version pinned in `.nvmrc` with the running Node version. */
export function checkNodeVersion(nvmrc: string, current: string): CheckResult {
  const required = /^v?(\d+)/.exec(nvmrc.trim())?.[1];
  if (!required) {
    return result([`.nvmrc must pin a numeric Node major version (got "${nvmrc.trim()}")`]);
  }
  const actual = current.replace(/^v/, "").split(".")[0];
  return actual === required
    ? result([])
    : result([
        `Node ${required} is required (from .nvmrc) but ${current} is active. Run \`nvm use\`.`,
      ]);
}
