/** Theme revision polling tests: epoch-aware changes, overlap prevention, and fail-closed recovery. */
import { expect, test } from "bun:test";
import { createThemeRevisionPoller } from "./use-theme-events";

test("a changed revision or epoch refreshes, while an unchanged pair does not", async () => {
  let value: unknown = { epoch: "a".repeat(48), revision: 9 }, changes = 0, failures = 0;
  const poller = createThemeRevisionPoller(async () => value, () => { changes++; }, () => { failures++; });
  await poller.poll(); await poller.poll();
  value = { epoch: "b".repeat(48), revision: 0 }; await poller.poll();
  value = { epoch: "b".repeat(48), revision: 1 }; await poller.poll();
  await poller.poll();
  expect([changes, failures]).toEqual([3, 0]);
});

test("an in-flight read is not overlapped and a reset fences its late result", async () => {
  let finish!: (value: unknown) => void, changes = 0, reads = 0;
  const poller = createThemeRevisionPoller(() => { reads++; return new Promise((resolve) => { finish = resolve; }); }, () => { changes++; }, () => undefined);
  const first = poller.poll(); await poller.poll();
  expect([reads, poller.busy()]).toEqual([1, true]);
  poller.reset(); finish({ epoch: "stale", revision: 1 }); await first;
  expect([changes, poller.busy()]).toEqual([0, false]);
});

test("invalid reads fail closed and reset the cursor for the next verified response", async () => {
  let value: unknown = { epoch: "c".repeat(48), revision: 2 }, changes = 0, failures = 0;
  const poller = createThemeRevisionPoller(async () => value, () => { changes++; }, () => { failures++; });
  await poller.poll(); value = { epoch: "c".repeat(48), revision: -1 }; await poller.poll();
  value = { epoch: "c".repeat(48), revision: 2 }; await poller.poll();
  expect([changes, failures]).toEqual([2, 1]);
});

test("revision envelope rejects malformed epochs and extra authority fields", async () => {
  let value: unknown = { epoch: "F".repeat(48), revision: 1 }, failures = 0;
  const poller = createThemeRevisionPoller(async () => value, () => undefined, () => { failures++; });
  await poller.poll(); value = { epoch: ["a".repeat(48)], revision: 1 }; await poller.poll();
  value = { epoch: "d".repeat(48), revision: 1, themeId: "encore" }; await poller.poll();
  expect(failures).toBe(3);
});
