export interface CheckResult {
  ok: boolean;
  violations: string[];
}

export const result = (violations: string[]): CheckResult => ({
  ok: violations.length === 0,
  violations,
});
