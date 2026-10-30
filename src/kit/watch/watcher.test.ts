/** Proves the polling shell emits one coalesced change and tears down cleanly. */
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { fakeComputer } from "../../stage/crypto/fake-device-vault";
import { createLibrary, type LibraryHandle } from "../../ui/library-root";
import { createBridge, type EntitySummary } from "../bridge";
import { scheduleFsWatch, watchStudio, type WatchScheduler } from "./watcher";

test("polls from an injected baseline and stops through the scheduler handle", async () => {
  const before: EntitySummary[] = [{ id: "basil", kind: "character", name: "Basil" }];
  const after: EntitySummary[] = [...before, { id: "mira", kind: "character", name: "Mira" }];
  const scheduled: { poll?: () => Promise<void> } = {};
  let stopped = false;
  const schedule: WatchScheduler = (run) => {
    scheduled.poll = run;
    return () => {
      stopped = true;
    };
  };
  const changes: string[][] = [];
  const stop = watchStudio({
    initial: before,
    list: async () => after,
    onChange: (change) => changes.push(change.added.map((item) => item.name)),
    schedule,
  });
  if (!scheduled.poll) throw new Error("watch poll was not scheduled");
  await scheduled.poll();
  expect(changes).toEqual([["Mira"]]);
  stop();
  expect(stopped).toBe(true);
});

/**
 * the scale design, "Kit watcher poll -> the change stream": a change on disk polls
 * once, instead of on a fixed beat forever. Proven against a real throwaway folder (a fake fs.watch
 * would only prove the wiring, not that a real write actually reaches it).
 */
const dirs: string[] = [];
const libraries: LibraryHandle[] = [];
afterEach(async () => {
  // Close before removing: an open SQLite handle on a file about to be deleted is a Windows lock,
  // not a no-op, the same ordering library-lifecycle.test.ts's own afterEach uses.
  for (const l of libraries.splice(0)) await l.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("scheduleFsWatch polls once after a real write, and not on a fixed beat with nothing changed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunzai-kit-watch-"));
  dirs.push(dir);
  let polls = 0;
  const unschedule = scheduleFsWatch(dir)(async () => { polls += 1; }, 100_000); // a beat too slow to fire on its own within this test
  await Bun.sleep(30); // let the watcher attach
  writeFileSync(join(dir, "x.json"), "x");
  await Bun.sleep(250); // past QUIET_MS (150ms)
  expect(polls).toBeGreaterThanOrEqual(1);
  const afterFirstWrite = polls;
  await Bun.sleep(150); // no further write: the fixed beat (100s) must not have fired either
  expect(polls).toBe(afterFirstWrite);
  unschedule();
});

test("scheduleFsWatch falls back to the plain interval when the recursive watch is refused", async () => {
  // A path that cannot be watched (does not exist): the real fs.watch call throws synchronously.
  const missing = join(tmpdir(), "bunzai-kit-watch-missing", String(Date.now()));
  let polls = 0;
  const unschedule = scheduleFsWatch(missing)(async () => { polls += 1; }, 20);
  await Bun.sleep(60);
  expect(polls).toBeGreaterThan(0);
  unschedule();
});

const card = (id: string): string =>
  JSON.stringify({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id,
    body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
  });

/**
 * the scale design's other half: the sibling test above proves the debounce with a
 * no-op poll callback, which cannot see whether the REAL read - bridge.list(), a SQLite-backed
 * ContentStore read living inside the same watched folder (studio-on-sqlite.md's library.db) - is
 * itself inert. If a read ever left a WAL checkpoint, a lock file, or a touched mtime behind, the
 * recursive watch installed on that same folder would see it as "a change", call bridge.list() again
 * to answer it, see its own leftovers again, and so on forever - a self-sustaining poll loop with no
 * external cause. Proven against a real opened library (createLibrary), not a fake store, because a
 * fake ContentStore cannot possibly reproduce a SQLite side effect it has no code path for.
 */
test("scheduleFsWatch settles: bridge.list() reading a real opened library never retriggers the watch itself", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunzai-kit-watch-bridge-"));
  dirs.push(dir);
  mkdirSync(join(dir, "character"), { recursive: true });
  writeFileSync(join(dir, "character", "vera.json"), card("vera"));

  const library = createLibrary(dir, { vault: fakeComputer(), sessionsDir: join(dir, "..", "sessions") });
  libraries.push(library);
  await library.open();

  const bridge = createBridge(dir);
  // A second, observe-only watch on the same folder: when the count assertion trips, the message names
  // WHICH file the extra event was (a library.db tail, an access-time touch, our own write) and when,
  // relative to each list call, instead of leaving only "expected 1, received 2".
  const t0 = performance.now();
  const at = (): string => (performance.now() - t0).toFixed(0);
  const trace: string[] = [];
  const observer = watch(dir, { recursive: true }, (type, name) => trace.push(`${at()}ms event ${type} ${String(name)}`));
  let listCalls = 0;
  const countedList = async (): Promise<EntitySummary[]> => {
    listCalls += 1;
    trace.push(`${at()}ms list #${listCalls} starts`);
    const result = await bridge.list();
    trace.push(`${at()}ms list #${listCalls} done`);
    return result;
  };

  const stop = watchStudio({
    initial: await bridge.list(),
    list: countedList,
    onChange: () => {},
    intervalMs: 600_000, // far slower than this test; isolates the proof to the recursive watch alone
    schedule: scheduleFsWatch(dir),
  });
  await Bun.sleep(30); // let the watcher attach

  // One real external change, exactly the sibling test's own write - the only thing that should
  // ever fire runSoon from here on.
  writeFileSync(join(dir, "character", "mira.json"), "a plain folder write, not imported");
  trace.push(`${at()}ms external write`);
  // Wait for the first poll to have run (bounded), rather than guessing it fits inside a fixed sleep:
  // a slow start is not what this test is about, a poll that keeps coming is.
  for (let waited = 0; listCalls < 1 && waited < 5_000; waited += 10) await Bun.sleep(10);
  await Bun.sleep(100); // let that poll finish and any event it caused arrive
  const why = (): string => `\n${trace.join("\n")}`;

  expect(listCalls, why()).toBeGreaterThanOrEqual(1);
  const afterSettle = listCalls;

  // Nothing external touches the folder again. A poll count that keeps climbing from here is
  // bridge.list() retriggering its own watch; a flat count is the proof it does not.
  await Bun.sleep(150);
  expect(listCalls, why()).toBe(afterSettle);
  await Bun.sleep(150);
  expect(listCalls, why()).toBe(afterSettle); // still flat on a second window: settled, not merely slow

  stop();
  observer.close();
});
