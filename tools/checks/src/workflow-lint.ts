import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { type CheckResult, result } from "./result.ts";

export interface JobPolicy {
  os?: string[];
}
export interface WorkflowPolicy {
  triggers: string[];
  jobs: Record<string, JobPolicy>;
}
export interface Policy {
  workflows: Record<string, WorkflowPolicy>;
  dependabotEcosystems: string[];
}

const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;

function jobOses(job: any): string[] {
  const runsOn = job?.["runs-on"];
  if (typeof runsOn === "string" && !runsOn.includes("${{")) return [runsOn];
  const matrixOs = job?.strategy?.matrix?.os;
  return Array.isArray(matrixOs) ? matrixOs : [];
}

/** Lint one parsed workflow against its policy (or just the generic rules if none). */
export function lintWorkflow(name: string, wf: any, policy?: WorkflowPolicy): string[] {
  const v: string[] = [];
  if (!wf || typeof wf !== "object") return [`${name}: not a valid workflow`];
  if (!wf.permissions) v.push(`${name}: missing top-level "permissions" block`);

  const on = wf.on ?? wf[true as any]; // YAML 1.1 may parse `on` as boolean true
  const triggers = typeof on === "string" ? [on] : Array.isArray(on) ? on : Object.keys(on ?? {});
  for (const t of policy?.triggers ?? []) {
    if (!triggers.includes(t)) v.push(`${name}: missing trigger "${t}"`);
  }

  const jobs = wf.jobs ?? {};
  for (const [jobName, req] of Object.entries(policy?.jobs ?? {})) {
    const job = jobs[jobName];
    if (!job) {
      v.push(`${name}: missing required job "${jobName}"`);
      continue;
    }
    const oses = jobOses(job);
    for (const os of req.os ?? []) {
      if (!oses.includes(os)) v.push(`${name}: job "${jobName}" must run on ${os}`);
    }
  }

  for (const [jobName, job] of Object.entries<any>(jobs)) {
    for (const step of job?.steps ?? []) {
      const uses: unknown = step?.uses;
      if (typeof uses !== "string" || uses.startsWith("./") || uses.startsWith("docker://"))
        continue;
      if (!PINNED.test(uses)) {
        v.push(`${name}: job "${jobName}" uses "${uses}" which is not pinned to a full commit SHA`);
      }
    }
  }
  return v;
}

export function lintDependabot(cfg: any, ecosystems: string[]): string[] {
  const have = new Set((cfg?.updates ?? []).map((u: any) => u["package-ecosystem"]));
  return ecosystems.filter((e) => !have.has(e)).map((e) => `dependabot: missing ecosystem "${e}"`);
}

export function checkWorkflows(githubDir: string, policy: Policy): CheckResult {
  const v: string[] = [];
  for (const [file, wfPolicy] of Object.entries(policy.workflows)) {
    const path = join(githubDir, "workflows", file);
    if (!existsSync(path)) {
      v.push(`${file}: required workflow is missing`);
      continue;
    }
    v.push(...lintWorkflow(file, parse(readFileSync(path, "utf8")), wfPolicy));
  }
  const dep = join(githubDir, "dependabot.yml");
  if (existsSync(dep)) {
    v.push(...lintDependabot(parse(readFileSync(dep, "utf8")), policy.dependabotEcosystems));
  } else {
    v.push("dependabot.yml is missing");
  }
  return result(v);
}
