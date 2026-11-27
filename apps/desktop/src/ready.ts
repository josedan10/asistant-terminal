import { invoke } from "@tauri-apps/api/core";

/**
 * Tell the backend the first frame has painted. The backend only prints the
 * `JARVIS_READY` line when `JARVIS_BENCH=1`, which the memory benchmark waits for.
 */
export function reportReady(
  start: number = performance.timeOrigin,
  call: typeof invoke = invoke,
  raf: (cb: () => void) => void = (cb) => requestAnimationFrame(() => cb()),
): Promise<void> {
  return new Promise((resolve) => {
    // Two frames: the first schedules paint, the second runs after it.
    raf(() =>
      raf(() => {
        const ms = Math.round(Date.now() - start);
        call("app_ready", { ms })
          .catch(() => undefined)
          .finally(resolve);
      }),
    );
  });
}
