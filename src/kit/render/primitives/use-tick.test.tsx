/** useTick owns the timer lifecycle and stops it when the display is inactive. */
import { describe, expect, spyOn, test } from "bun:test";
import { useTick } from "./use-tick";
import { settleRender, testRender } from "../test-render";
import type { ReactNode } from "react";

function Probe({ active, read }: { active: boolean; read(value: number): void }): ReactNode {
  read(useTick(10, active));
  return null;
}

describe("useTick", () => {
  test("ticks while active and holds its count while inactive", async () => {
    let tick = -1;
    const renderer = await testRender(<Probe active read={(value) => { tick = value; }} />, {
      width: 20,
      height: 5,
    });
    await settleRender(45);
    expect(tick).toBeGreaterThan(0);
    await renderer.renderer.destroy();

    let paused = -1;
    const stopped = await testRender(<Probe active={false} read={(value) => { paused = value; }} />, {
      width: 20,
      height: 5,
    });
    await settleRender(35);
    expect(paused).toBe(0);
    await stopped.renderer.destroy();
  });

  test("clears its interval when the renderable unmounts", async () => {
    const start = globalThis.setInterval;
    const stop = globalThis.clearInterval;
    let timer: unknown;
    const cleared: unknown[] = [];
    const started = spyOn(globalThis, "setInterval").mockImplementation(((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
      timer = start(fn, ms, ...args);
      return timer as unknown as number;
    }) as unknown as typeof globalThis.setInterval);
    const stopped = spyOn(globalThis, "clearInterval").mockImplementation(((id?: unknown) => {
      if (id !== undefined) cleared.push(id);
      return stop(id as never);
    }) as unknown as typeof globalThis.clearInterval);
    try {
      const renderer = await testRender(<Probe active read={() => undefined} />, { width: 20, height: 5 });
      expect(timer).toBeDefined();
      await renderer.renderer.destroy();
      expect(cleared).toContain(timer);
    } finally {
      started.mockRestore();
      stopped.mockRestore();
    }
  });
});
