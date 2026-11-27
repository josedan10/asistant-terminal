import { describe, expect, it, vi } from "vitest";
import { reportReady } from "./ready.ts";

describe("reportReady", () => {
  const syncRaf = (cb: () => void) => cb();

  it("invokes app_ready once after two frames with elapsed ms", async () => {
    const call = vi.fn().mockResolvedValue(undefined);
    const raf = vi.fn(syncRaf);
    await reportReady(Date.now() - 50, call, raf);
    expect(raf).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[0]).toBe("app_ready");
    expect(call.mock.calls[0]?.[1].ms).toBeGreaterThanOrEqual(50);
  });

  it("swallows backend errors (e.g. running outside Tauri)", async () => {
    const call = vi.fn().mockRejectedValue(new Error("no ipc"));
    await expect(reportReady(Date.now(), call, syncRaf)).resolves.toBeUndefined();
  });
});
