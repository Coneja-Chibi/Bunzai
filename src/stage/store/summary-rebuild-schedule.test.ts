/**
 * summary-rebuild-schedule.ts: `attempt()` runs the rebuild, backs off on failure (mirroring the
 * keyring's own pending-cleanup retry), and a lock mid-rebuild is recovered by the next `attempt()`
 * (the caller's "after the next unlock" trigger, exercised directly here) rather than left stale.
 */
import { describe, expect, test } from "bun:test";
import { LockedError } from "../crypto/keyring-errors";
import { createRebuildScheduler } from "./summary-rebuild-schedule";
import { memoryDocumentBackend } from "./memory/document-backend";
import type { DocumentBackend, DocumentRow, PartChange, VersionRow } from "../contracts/content-store";

const row = (id: string): DocumentRow => ({ kind: "character", id, revision: `r-${id}`, version: 1, writeId: 1, autosaveStartedAt: null, createdAt: 1, updatedAt: 1 });
const ver = (id: string): VersionRow => ({ kind: "character", id, version: 1, revision: `r-${id}`, savedAt: 1, reason: "create", autosaveStartedAt: null });
/** The scheduler and its driver never open a part themselves; only a live row needs to exist. */
const change = (): PartChange => ({ put: [{ name: "h", text: "0:", blobs: [] }], drop: [] });
const compute = async () => ({ writeId: 1, summary: { text: "computed", derivedVersion: "1" } });

/** Wraps a backend so its FIRST `get()` call throws `LockedError`, simulating a lock mid-rebuild. */
function lockedOnFirstGet(inner: DocumentBackend): DocumentBackend {
  let gets = 0;
  return {
    ...inner,
    async get(kind, id) {
      gets++;
      if (gets === 1) throw new LockedError();
      return inner.get(kind, id);
    },
  };
}

describe("createRebuildScheduler", () => {
  test("attempt() runs once and further calls are free no-ops once finished", async () => {
    const backend = memoryDocumentBackend();
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, change());
    let calls = 0;
    const counted = async () => {
      calls++;
      return compute();
    };
    const scheduler = createRebuildScheduler(backend, "1", counted);
    scheduler.attempt();
    await Bun.sleep(10);
    expect(scheduler.isDone()).toBe(true);
    expect(calls).toBe(1);
    scheduler.attempt();
    scheduler.attempt();
    await Bun.sleep(10);
    expect(calls).toBe(1); // no further runs once finished
  });

  test("a run in flight is not started twice", async () => {
    const backend = memoryDocumentBackend();
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, change());
    // rebuildSummaries' own first call is summaries(): slow it down so the run stays "in flight"
    // long enough for a second attempt() to land while it is still going.
    let concurrent = 0;
    let maxConcurrent = 0;
    const slowed: DocumentBackend = {
      ...backend,
      async summaries(kind) {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await Bun.sleep(15);
        concurrent--;
        return backend.summaries(kind);
      },
    };
    const scheduler = createRebuildScheduler(slowed, "1", compute);
    scheduler.attempt();
    scheduler.attempt(); // fired while the first is still running: must not overlap it
    await Bun.sleep(40);
    expect(maxConcurrent).toBe(1);
  });

  test("a lock mid-rebuild is recovered by the next attempt() instead of leaving rows stale", async () => {
    const backend = memoryDocumentBackend();
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, change());
    const locked = lockedOnFirstGet(backend);
    // `compute` owns its own read now (the S5 fold), so it is `compute`'s own `get()` - mirroring
    // `computeSummaryFor` in production - that the lock has to hit, not `rebuildSummaries`' own.
    const lockedCompute = async (kind: string, id: string) => {
      const current = await locked.get(kind, id);
      return current ? { writeId: current.writeId, summary: { text: "computed", derivedVersion: "1" } } : null;
    };
    let now = 0;
    const scheduler = createRebuildScheduler(locked, "1", lockedCompute, undefined, () => now);

    scheduler.attempt(); // the rebuild's own get() throws LockedError: this run fails
    await Bun.sleep(10);
    expect(scheduler.isDone()).toBe(false);
    expect((await backend.summaries()).rows[0]?.summary).toBeNull(); // still stale: never clobbered, never lost

    // "the next unlock": the caller's own retry trigger, fired again. The lock is gone now (this
    // wrapper only fails the FIRST get()), so this attempt runs the real backend end to end.
    now = 61_000; // past FIRST_RETRY_MS (60 s), the backoff window opened by the failed attempt
    scheduler.attempt();
    await Bun.sleep(10);
    expect(scheduler.isDone()).toBe(true);
    expect((await backend.summaries()).rows[0]?.summary).toBe("computed");
  });

  test("failure backs off: an immediate retry before the window elapses is a no-op", async () => {
    const backend = memoryDocumentBackend();
    let calls = 0;
    // A backend whose very first read fails every time it's asked, so every attempt fails until the
    // test stops breaking it.
    const throwing: DocumentBackend = { ...backend, async summaries() { calls++; throw new Error("boom"); } };
    let now = 0;
    const scheduler = createRebuildScheduler(throwing, "1", compute, undefined, () => now);

    scheduler.attempt();
    await Bun.sleep(10);
    expect(calls).toBe(1);

    scheduler.attempt(); // still inside the backoff window opened by the failure above: a no-op
    await Bun.sleep(10);
    expect(calls).toBe(1);

    now = 61_000; // past FIRST_RETRY_MS (60 s)
    scheduler.attempt();
    await Bun.sleep(10);
    expect(calls).toBe(2);
  });
});
