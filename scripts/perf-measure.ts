/**
 * The perf gates' one stopwatch: runs `work` while a heartbeat timer records the longest time the
 * event loop was held (the main thread's freeze), and how long the work took in all.
 */

/** The longest the event loop was held while `work` ran, and how long it took in all. */
export async function measure(work: () => Promise<unknown>): Promise<{ freezeMs: number; totalMs: number }> {
  let longest = 0;
  let last = performance.now();
  const beat = setInterval(() => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
  }, 2);
  const started = performance.now();
  await work();
  const totalMs = performance.now() - started;
  // One more beat, so a freeze that ends with the work is still measured.
  await new Promise((r) => setTimeout(r, 20));
  clearInterval(beat);
  return { freezeMs: longest, totalMs };
}
