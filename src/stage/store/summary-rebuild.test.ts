/**
 * The D2 rebuild driver, run against the memory backend (it works through the plain DocumentBackend
 * contract, so any backend proves it). Covers: fills every missing or stale summary, leaves an
 * up-to-date one untouched, respects a compute that declines, and never lets a racing edit's summary
 * be overwritten with one computed from the body it no longer holds.
 */
import { expect, test } from "bun:test";
import type { DocumentRow, PartChange, VersionRow } from "../contracts/content-store";
import { memoryDocumentBackend } from "./memory/document-backend";
import { rebuildSummaries } from "./summary-rebuild";

const row = (id: string, extra: Partial<DocumentRow> = {}): DocumentRow => ({
  kind: "character",
  id,
  revision: `r-${id}`,
  version: 1,
  writeId: extra.version ?? 1,
  autosaveStartedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const ver = (id: string, extra: Partial<VersionRow> = {}): VersionRow => ({
  kind: "character",
  id,
  version: 1,
  revision: `r-${id}`,
  savedAt: 1,
  reason: "create",
  autosaveStartedAt: null,
  ...extra,
});
/** The rebuild driver never opens a part itself - that is `compute`'s job - so a fresh write's part
 * content is arbitrary here: only its presence (so `backend.get` finds a live row) matters. */
const change = (): PartChange => ({ put: [{ name: "h", text: "0:", blobs: [] }], drop: [] });

test("fills every summary that is missing, leaving an up-to-date one untouched", async () => {
  const backend = memoryDocumentBackend();
  await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, change()); // no summary yet
  await backend.write(row("mira"), ver("mira"), { when: "absent" }, { text: "already current", derivedVersion: "2" }, change());

  const seen: string[] = [];
  const progress = await rebuildSummaries(backend, "2", async (kind, id) => {
    seen.push(id);
    return { writeId: 1, summary: { text: `computed for ${id}`, derivedVersion: "2" } };
  });

  expect(progress).toEqual({ done: 1, total: 1 });
  expect(seen).toEqual(["vera"]); // mira was already at derivedVersion 2: never even read
  const summaries = Object.fromEntries((await backend.summaries()).rows.map((s) => [s.id, s]));
  expect(summaries.vera).toMatchObject({ summary: "computed for vera", derivedVersion: "2" });
  expect(summaries.mira).toMatchObject({ summary: "already current", derivedVersion: "2" });
});

test("a summary computed by an older code version is treated as stale and rebuilt", async () => {
  const backend = memoryDocumentBackend();
  await backend.write(row("vera"), ver("vera"), { when: "absent" }, { text: "old code's summary", derivedVersion: "1" }, change());

  await rebuildSummaries(backend, "2", async () => ({ writeId: 1, summary: { text: "new code's summary", derivedVersion: "2" } }));

  expect((await backend.summaries()).rows[0]).toMatchObject({ summary: "new code's summary", derivedVersion: "2" });
});

test("a compute that declines leaves the row 'not computed', and progress still advances", async () => {
  const backend = memoryDocumentBackend();
  await backend.write(row("damaged"), ver("damaged"), { when: "absent" }, null, change());

  const progress = await rebuildSummaries(backend, "1", async () => null);

  expect(progress).toEqual({ done: 1, total: 1 });
  expect((await backend.summaries()).rows[0]?.summary).toBeNull();
});

test("reports progress from 0 up to total, one step per row", async () => {
  const backend = memoryDocumentBackend();
  await backend.write(row("a"), ver("a"), { when: "absent" }, null, change());
  await backend.write(row("b"), ver("b"), { when: "absent" }, null, change());

  const steps: { done: number; total: number }[] = [];
  await rebuildSummaries(backend, "1", async () => ({ writeId: 1, summary: { text: "x", derivedVersion: "1" } }), (p) => steps.push({ ...p }));

  expect(steps).toEqual([
    { done: 0, total: 2 },
    { done: 1, total: 2 },
    { done: 2, total: 2 },
  ]);
});

test("a row edited mid-rebuild loses that run's race, and is left for the next one", async () => {
  const backend = memoryDocumentBackend();
  await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, change());

  // `compute` owns its own read now (the S5 fold: one read per stale row, not two), so the race this
  // test proves is simulated inside it: another writer edits the row between compute's own read and
  // `rebuildSummaries`' later call to `rewriteSummary` with the write identity compute read.
  const compute = async (kind: string, id: string) => {
    const current = await backend.get(kind, id);
    if (!current) return null;
    await backend.write(
      { ...current, revision: "r2", version: current.version + 1, writeId: current.writeId + 1 },
      { kind, id, version: current.version + 1, revision: "r2", savedAt: 2, reason: "save", autosaveStartedAt: null },
      { when: "writeId", expected: current.writeId },
      null,
      change(),
    );
    // Still reports the write identity it read, before the race above landed - rewriteSummary's own identity
    // check is what must refuse this, not anything compute does.
    return { writeId: current.writeId, summary: { text: "computed from the old body", derivedVersion: "1" } };
  };

  const progress = await rebuildSummaries(backend, "1", compute);

  expect(progress).toEqual({ done: 1, total: 1 });
  // Lost the write identity race inside rewriteSummary: never overwritten with a summary of a body it no
  // longer holds. The row is still "not computed" and will be picked up by the next rebuild run.
  expect((await backend.summaries()).rows[0]?.summary).toBeNull();
  expect((await backend.get("character", "vera"))?.version).toBe(2);
});
