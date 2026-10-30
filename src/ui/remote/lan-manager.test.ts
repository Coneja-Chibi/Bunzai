/** Off revokes both a running LAN listener and a listener still being started. */
import { expect, test } from "bun:test";
import { createLanManager } from "./lan-manager";
import type { LanServerHandle } from "./lan-server";

test("disable wins over pending startup and concurrent enables share one listener", async () => {
  const ready = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<LanServerHandle>();
  let starts = 0;
  let stops = 0;
  const manager = createLanManager({ now: () => 1, port: 0, certDir: "unused", makeAppHandler: () => async () => new Response("test"), start: () => { starts++; ready.resolve(); return pending.promise; } });
  const first = manager.enable();
  const second = manager.enable();
  await ready.promise;
  await manager.disable();
  pending.resolve({ origin: "https://test", fingerprint: "test", stop: () => { stops++; } });
  await Promise.all([first, second]);
  expect(manager.status().on).toBe(false);
  expect(starts).toBe(1);
  expect(stops).toBe(1);
});
