import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { type CheckResult, result } from "./result.ts";

const REVIEW_BY = /review-by:\s*\d{4}-\d{2}-\d{2}/;

/** cargo-deny: each advisories.ignore entry must be a table with a reason containing review-by. */
export function denyIgnores(toml: string): string[] {
  const cfg = parseToml(toml) as any;
  return (cfg.advisories?.ignore ?? []).flatMap((e: any) => {
    const id = typeof e === "string" ? e : e.id;
    const reason = typeof e === "string" ? "" : (e.reason ?? "");
    return REVIEW_BY.test(reason)
      ? []
      : [`deny.toml: ignore "${id}" needs reason with "review-by: YYYY-MM-DD"`];
  });
}

/** osv-scanner: each [[IgnoredVulns]] needs reason and ignoreUntil. */
export function osvIgnores(toml: string): string[] {
  const cfg = parseToml(toml) as any;
  return (cfg.IgnoredVulns ?? []).flatMap((e: any) => {
    const v: string[] = [];
    if (!e.reason) v.push(`osv-scanner.toml: ignore "${e.id}" needs a reason`);
    if (!e.ignoreUntil) v.push(`osv-scanner.toml: ignore "${e.id}" needs ignoreUntil`);
    return v;
  });
}

/** gitleaks: each allowlist needs a description containing review-by. */
export function gitleaksIgnores(toml: string): string[] {
  const cfg = parseToml(toml) as any;
  const lists = [...(cfg.allowlists ?? []), ...(cfg.allowlist ? [cfg.allowlist] : [])];
  return lists.flatMap((a: any, i: number) =>
    REVIEW_BY.test(a.description ?? "")
      ? []
      : [`.gitleaks.toml: allowlist #${i + 1} needs description with "review-by: YYYY-MM-DD"`],
  );
}

/** .semgrepignore: each pattern must follow a "# reason: ... review-by: DATE" comment. */
export function semgrepIgnores(text: string): string[] {
  const v: string[] = [];
  let justified = false;
  for (const [n, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      justified = /reason:/.test(line) && REVIEW_BY.test(line);
      continue;
    }
    if (!justified)
      v.push(
        `.semgrepignore:${n + 1}: "${line}" needs a preceding "# reason: ... review-by: YYYY-MM-DD"`,
      );
    justified = false;
  }
  return v;
}

export function checkIgnorePolicy(root: string): CheckResult {
  const read = (f: string) =>
    existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : null;
  const v: string[] = [];
  const deny = read("deny.toml");
  const osv = read("osv-scanner.toml");
  const gl = read(".gitleaks.toml");
  const sg = read(".semgrepignore");
  if (deny !== null) v.push(...denyIgnores(deny));
  if (osv !== null) v.push(...osvIgnores(osv));
  if (gl !== null) v.push(...gitleaksIgnores(gl));
  if (sg !== null) v.push(...semgrepIgnores(sg));
  return result(v);
}
