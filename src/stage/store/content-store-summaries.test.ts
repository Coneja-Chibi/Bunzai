/**
 * content-store.ts's wiring of summary-content.ts: every write path leaves
 * the backend's summary equal to `buildSummary` of the body just stored, and the `rebuildOnStart`
 * option fills missing or stale summaries in the background without ever
 * clobbering a concurrent write. Runs against the memory backend, the same contract every real
 * backend proves through `content-store.contract.ts`.
 */
import { describe, expect, test } from "bun:test";
import { decompose } from "../../entities/piece-parts";
import { fullCharacter } from "../../entities/runtime-schema.full-surface.fixtures";
import type { DocumentBackend, DocumentRow, PartChange, VersionRow } from "../contracts/content-store";
import { createContentStore } from "./content-store";
import { memoryDocumentBackend } from "./memory/document-backend";
import { buildPartText } from "./content-store-write";
import { buildSummary, DERIVED_VERSION } from "./summary-content";
import type { RebuildProgress } from "./summary-rebuild";

const character = (id: string, name = id) => ({ ...fullCharacter, id, body: { ...fullCharacter.body, identity: { ...fullCharacter.body.identity, name } } });

const summaryOf = async (backend: DocumentBackend, kind: string, id: string) => (await backend.summaries(kind)).rows.find((s) => s.id === id);

describe("content-store: every write keeps the summary current", () => {
  test("create writes a summary matching the body, stamped with DERIVED_VERSION and the row's revision", async () => {
    const backend = memoryDocumentBackend();
    const store = createContentStore(backend, () => 1);
    await store.create(character("vera"));
    const row = await backend.get("character", "vera");
    const summary = await summaryOf(backend, "character", "vera");
    expect(summary?.derivedVersion).toBe(DERIVED_VERSION);
    expect(summary?.revision).toBe(row?.revision);
    expect(summary?.summary).toBe(buildSummary(character("vera")).text);
  });

  test("a rename (save, overwrite) recomputes the summary", async () => {
    const backend = memoryDocumentBackend();
    const store = createContentStore(backend, () => 1);
    await store.create(character("vera", "First"));
    await store.save(character("vera", "Renamed"), { overwrite: true });
    const summary = await summaryOf(backend, "character", "vera");
    expect(JSON.parse(summary!.summary!)).toMatchObject({ name: "Renamed" });
  });

  test("an art change (accent) recomputes the summary", async () => {
    const backend = memoryDocumentBackend();
    const store = createContentStore(backend, () => 1);
    const withAccent = {
      ...character("vera"),
      body: { ...character("vera").body, presentation: { signatureColor: "#ab12cd" } },
    };
    await store.create(withAccent);
    const summary = await summaryOf(backend, "character", "vera");
    expect(JSON.parse(summary!.summary!)).toMatchObject({ accent: "#ab12cd" });
  });

  test("bury moves the summary to the grave, unbury brings it home unchanged", async () => {
    const backend = memoryDocumentBackend();
    const store = createContentStore(backend, () => 1);
    await store.create(character("vera"));
    const before = await summaryOf(backend, "character", "vera");
    await store.delete("character", "vera");
    expect(await summaryOf(backend, "character", "vera")).toBeUndefined();
    const { rows: graves } = await backend.graves("character");
    expect(graves).toHaveLength(1);
    const restored = await store.restore(graves[0]!.graveId);
    expect(restored?.id).toBe("vera");
    const after = await summaryOf(backend, "character", "vera");
    expect(after?.summary).toBe(before?.summary);
  });

  test("saveIfUnchanged also recomputes the summary on a successful save", async () => {
    const backend = memoryDocumentBackend();
    const store = createContentStore(backend, () => 1);
    const created = await store.create(character("vera", "First"));
    if (created.status !== "saved") throw new Error("setup failed");
    const result = await store.saveIfUnchanged(character("vera", "Second"), created.summary.revision);
    expect(result.status).toBe("saved");
    const summary = await summaryOf(backend, "character", "vera");
    expect(JSON.parse(summary!.summary!)).toMatchObject({ name: "Second" });
  });
});

/** Waits for a `rebuildOnStart` run to finish: its own progress reaches done === total (or total 0). */
function awaitRebuild(): { onProgress: (p: RebuildProgress) => void; done: Promise<void> } {
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  return {
    onProgress: (p) => {
      if (p.total === 0 || p.done === p.total) resolve();
    },
    done,
  };
}

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
/** A real part set for `character(id)`, so `computeSummaryFor` genuinely assembles and reads it back
 * the way a live write would - not a stand-in the rebuild driver never opens. */
const partsFor = (id: string): PartChange => ({ put: decompose(character(id)).map(buildPartText), drop: [] });

describe("content-store: rebuildOnStart (D2)", () => {
  test("fills a summary that was never computed, without blocking the constructor", async () => {
    const backend = memoryDocumentBackend();
    // planted with no summary, as a plain folder import leaves it
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, partsFor("vera"));
    const rebuild = awaitRebuild();
    createContentStore(backend, () => 1, { rebuildOnStart: { onProgress: rebuild.onProgress } });
    // The constructor returned already; the rebuild is still running on its own.
    await rebuild.done;
    const summary = (await backend.summaries()).rows[0];
    expect(summary?.summary).toBe(buildSummary(character("vera")).text);
    expect(summary?.derivedVersion).toBe(DERIVED_VERSION);
  });

  test("a summary stamped with an older DERIVED_VERSION is treated as stale and rebuilt", async () => {
    const backend = memoryDocumentBackend();
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, { text: "stale text", derivedVersion: "0" }, partsFor("vera"));
    const rebuild = awaitRebuild();
    createContentStore(backend, () => 1, { rebuildOnStart: { onProgress: rebuild.onProgress } });
    await rebuild.done;
    const summary = (await backend.summaries()).rows[0];
    expect(summary?.derivedVersion).toBe(DERIVED_VERSION);
    expect(summary?.summary).not.toBe("stale text");
  });

  test("a summary already at DERIVED_VERSION is left untouched (no rewrite call at all)", async () => {
    const backend = memoryDocumentBackend();
    let rewrites = 0;
    const current = { text: buildSummary(character("vera")).text, derivedVersion: DERIVED_VERSION };
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, current, partsFor("vera"));
    const counting: DocumentBackend = {
      ...backend,
      async rewriteSummary(...args) {
        rewrites++;
        return backend.rewriteSummary(...args);
      },
    };
    const rebuild = awaitRebuild();
    createContentStore(counting, () => 1, { rebuildOnStart: { onProgress: rebuild.onProgress } });
    await rebuild.done;
    expect(rewrites).toBe(0);
  });

  test("never blocks a write issued right after construction: the write's own summary is never clobbered by the rebuild", async () => {
    const backend = memoryDocumentBackend();
    // no summary yet, so a rebuild is pending
    await backend.write(row("vera"), ver("vera"), { when: "absent" }, null, partsFor("vera"));
    const rebuild = awaitRebuild();
    const store = createContentStore(backend, () => 2, { rebuildOnStart: { onProgress: rebuild.onProgress } });
    // A normal write, issued immediately: it must not wait on the rebuild, and its own fresh summary
    // must still be the one standing once the rebuild (which may still be racing it) finishes.
    await store.save(character("vera", "Edited"), { overwrite: true });
    await rebuild.done;
    const summary = (await backend.summaries()).rows[0];
    expect(JSON.parse(summary!.summary!)).toMatchObject({ name: "Edited" });
  });
});
