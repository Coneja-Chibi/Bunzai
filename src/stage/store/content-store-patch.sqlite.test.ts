/**
 * The patch path's SQLite-only proof: the write
 * cache empties on lock and refuses a patch while locked, and the row-quarantine fix (ChatStore rule
 * 25) for `summaries()`/`documentVersions()`, the two list reads `ContentStore.summaries` itself
 * depends on. Split from content-store.sqlite.test.ts for the line cap.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { revisionFromParts } from "../../entities/canonical-revision";
import { decompose } from "../../entities/piece-parts";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { LockedError } from "../crypto/keyring-errors";
import { character, presetWithEscrow } from "../contracts/content-store.contract-fixtures";
import type { DocumentRow, VersionRow } from "../contracts/content-store";
import { lockAll, setGate } from "../caches";
import { createContentStore } from "./content-store";
import { buildPartText } from "./content-store-write";
import { clearPieceCache, pieceCacheBytes } from "./piece-cache";
import { type StageDatabase } from "./sqlite/database";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
// The gate is one shared, process-wide closure (`src/stage/caches.ts`'s `setGate`): a keyring test
// elsewhere in this same bun process can leave it closed (locked) long after its own file finished, and
// this file's own tests can leave a fresh closed one registered too. Reopened both before AND after
// every test here, so neither direction leaks (keyring-token-cache.test.ts's own afterEach names the
// exact same trap for the token cache's gate).
beforeEach(() => setGate(() => true));
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  setGate(() => true);
});
const fresh = () => freshDatabase(open);

const row = (extra: Partial<DocumentRow> = {}): DocumentRow => ({
  kind: "character",
  id: "vera",
  revision: "r1",
  version: 1,
  writeId: extra.version ?? 1,
  autosaveStartedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const ver = (extra: Partial<VersionRow> = {}): VersionRow => ({
  kind: "character",
  id: "vera",
  version: 1,
  revision: "r1",
  savedAt: 1,
  reason: "create",
  autosaveStartedAt: null,
  ...extra,
});
const onePart = { put: [{ name: "h", text: "0:", blobs: [] }], drop: [] };

describe("SQLite backend: row quarantine for list reads (ChatStore rule 25)", () => {
  test("summaries() and documentVersions() quarantine a row with a damaged id_cell, never lose the other", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    await backend.write(row({ id: "vera" }), ver({ id: "vera" }), { when: "absent" }, { text: "s", derivedVersion: "1" }, onePart);
    await backend.write(row({ id: "mira" }), ver({ id: "mira" }), { when: "absent" }, { text: "s2", derivedVersion: "1" }, onePart);
    const cells = d.db.query("SELECT id, id_cell FROM documents ORDER BY id").all() as { id: string; id_cell: string }[];
    d.db.query("UPDATE documents SET id_cell = ? WHERE id = ?").run(cells[1]!.id_cell, cells[0]!.id);

    const summaries = await backend.summaries();
    expect(summaries.rows).toHaveLength(1);
    expect(summaries.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);

    const docVersions = await backend.documentVersions();
    expect(docVersions.rows).toHaveLength(1);
    expect(docVersions.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);
  });

  test("backend.versions() and ContentStore.versions() quarantine one damaged version, never lose the others", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend, () => 1);
    await store.save(character("vera"));
    await store.save(character("vera", "Edited"), { overwrite: true });

    const cells = d.db.query("SELECT rowid, revision FROM document_versions WHERE version = 1").all() as { rowid: number; revision: string }[];
    // Flip one character near the end of the sealed cell's own payload (never its "vvcell1:" prefix,
    // which `openCell` checks before the AEAD tag): a broken tag, the same failure a corrupted disk
    // sector would produce, is what `DamagedDataError` is actually for - unlike `id_cell`, a version's
    // `revision` is never checked against anything else, so swapping in another row's VALID cell would
    // just open to the wrong (but validly sealed) text instead of throwing.
    const broken = cells[0]!.revision;
    const flipped = broken.slice(0, -1) + (broken.at(-1) === "A" ? "B" : "A");
    d.db.query("UPDATE document_versions SET revision = ? WHERE rowid = ?").run(flipped, cells[0]!.rowid);

    const backendResult = await backend.versions("character", "vera");
    expect(backendResult.rows.map((v) => v.version)).toEqual([2]);
    expect(backendResult.quarantined).toEqual([1]);

    const storeResult = await store.versions("character", "vera");
    expect(storeResult.versions.map((v) => v.version)).toEqual([2]);
    expect(storeResult.quarantined).toEqual([1]);
  });

  test("graves() and graveSummaries() quarantine a grave whose id_cell was swapped onto the wrong row, never lose the healthy one beside it", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    await backend.write(row({ id: "vera" }), ver({ id: "vera" }), { when: "absent" }, { text: "s", derivedVersion: "1" }, onePart);
    await backend.write(row({ id: "mira" }), ver({ id: "mira" }), { when: "absent" }, { text: "s2", derivedVersion: "1" }, onePart);
    await backend.bury("character", "vera", "g-vera", 10);
    await backend.bury("character", "mira", "g-mira", 20);

    const cells = d.db.query("SELECT id, id_cell FROM document_graves ORDER BY id").all() as { id: string; id_cell: string }[];
    d.db.query("UPDATE document_graves SET id_cell = ? WHERE id = ?").run(cells[1]!.id_cell, cells[0]!.id);

    const graves = await backend.graves();
    expect(graves.rows).toHaveLength(1);
    expect(graves.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);

    const graveSummaries = await backend.graveSummaries();
    expect(graveSummaries.rows).toHaveLength(1);
    expect(graveSummaries.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);
  });

  test("graves() and graveSummaries() quarantine a grave with a genuinely corrupted (byte-flipped) id_cell", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    await backend.write(row({ id: "vera" }), ver({ id: "vera" }), { when: "absent" }, { text: "s", derivedVersion: "1" }, onePart);
    await backend.write(row({ id: "mira" }), ver({ id: "mira" }), { when: "absent" }, { text: "s2", derivedVersion: "1" }, onePart);
    await backend.bury("character", "vera", "g-vera", 10);
    await backend.bury("character", "mira", "g-mira", 20);

    const cells = d.db.query("SELECT id, id_cell FROM document_graves ORDER BY id").all() as { id: string; id_cell: string }[];
    // Flip one character near the end of the sealed cell's own payload (never its "vvcell1:" prefix,
    // which `openCell` checks before the AEAD tag): a broken tag, the same failure a corrupted disk
    // sector would produce - the versions quarantine test above proves the same disk-corruption shape,
    // this proves it for a grave's own identity cell.
    const broken = cells[0]!.id_cell;
    const flipped = broken.slice(0, -1) + (broken.at(-1) === "A" ? "B" : "A");
    d.db.query("UPDATE document_graves SET id_cell = ? WHERE id = ?").run(flipped, cells[0]!.id);

    const graves = await backend.graves();
    expect(graves.rows).toHaveLength(1);
    expect(graves.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);

    const graveSummaries = await backend.graveSummaries();
    expect(graveSummaries.rows).toHaveLength(1);
    expect(graveSummaries.quarantined).toEqual([{ kind: "character", key: cells[0]!.id }]);
  });

  test("ContentStore.graveyard and .graveSummaries never throw on a quarantined grave; the healthy one still shows", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend, () => 1);
    await store.create(character("vera"));
    await store.create(character("mira"));
    await store.delete("character", "vera");
    await store.delete("character", "mira");

    const cells = d.db.query("SELECT id, id_cell FROM document_graves ORDER BY id").all() as { id: string; id_cell: string }[];
    d.db.query("UPDATE document_graves SET id_cell = ? WHERE id = ?").run(cells[1]!.id_cell, cells[0]!.id);

    expect(await store.graveyard()).toHaveLength(1); // never throws out of the whole call
    expect(await store.graveSummaries()).toHaveLength(1);
  });

  test("ContentStore.inventory and .summaries report a quarantined row as damaged, and never crash", async () => {
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend, () => 1);
    await store.save(character("vera"));
    await store.save(character("mira"));
    const cells = d.db.query("SELECT id, id_cell FROM documents ORDER BY id").all() as { id: string; id_cell: string }[];
    d.db.query("UPDATE documents SET id_cell = ? WHERE id = ?").run(cells[1]!.id_cell, cells[0]!.id);

    const inv = await store.inventory();
    expect(inv.entities).toHaveLength(1);
    expect(inv.damaged).toEqual([{ kind: "character", id: cells[0]!.id, reason: "id-unreadable" }]);

    const sum = await store.summaries();
    expect(sum.entities).toHaveLength(1);
    expect(sum.damaged.some((entry) => entry.reason === "id-unreadable")).toBe(true);
  });
});

describe("SQLite backend: the patch path's write cache (S5)", () => {
  test("lock empties the cache and refuses the patch", async () => {
    clearPieceCache();
    const d = fresh();
    let locked = false;
    const inner = testCipher();
    const cipher = { ...inner, open: (where: string, cell: string) => { if (locked) throw new LockedError(); return inner.open(where, cell); } };
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend, () => 1);
    await store.save(presetWithEscrow("p"));
    const before = await store.read("preset", "p");

    const headOf = (name: string) => ({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: "p",
      body: { name, prompts: [] },
      original: { testfmt: { raw: null, unmapped: {} } },
    });
    const firstPatch = await store.patch("preset", "p", before!.revision, { head: headOf("P") });
    expect(firstPatch.status).toBe("saved");
    expect(pieceCacheBytes()).toBeGreaterThan(0); // the patch filled the cache

    locked = true;
    lockAll(); // the registry's lock funnel (src/stage/caches.ts), the same one keyring.ts calls
    expect(pieceCacheBytes()).toBe(0); // emptied

    const revisionAfter = firstPatch.status === "saved" ? firstPatch.summary.revision : before!.revision;
    await expect(store.patch("preset", "p", revisionAfter, { head: headOf("P again") })).rejects.toBeInstanceOf(LockedError);
    locked = false;
  });

  test("a lock landing between cold-fill's parts() read and the cache insert never caches the plaintext", async () => {
    // Reproduces the race a bare clear-on-lock misses: `patchPiece`'s cold fill awaits
    // `backend.lightBlobs()` (the last plaintext read of the fill), then calls `setCachedPiece` with no
    // re-check in between. A lock landing in that gap - `lockAll()` already ran, the cache already
    // empty - must still stop the fill's OWN insert moments later, the same race
    // `keyring-token-cache.test.ts` proves for `countText`.
    clearPieceCache();
    const d = fresh();
    let locked = false;
    const inner = testCipher();
    const cipher = {
      ...inner,
      open: (where: string, cell: string) => {
        if (locked) throw new LockedError();
        return inner.open(where, cell);
      },
      ready: () => {
        if (locked) throw new LockedError();
        inner.ready();
      },
    };
    // Mirrors keyring.ts's own `setGate(() => dataKey !== null)`: registered once, tracking `locked`
    // live from then on - never re-derived per call, exactly like the real gate source.
    setGate(() => !locked);
    let armLock = false;
    const realBackend = sqliteDocumentBackend(d, cipher);
    const lightBlobs = realBackend.lightBlobs.bind(realBackend);
    const backend = {
      ...realBackend,
      async lightBlobs(...args: Parameters<typeof lightBlobs>) {
        const result = await lightBlobs(...args);
        if (!armLock) return result;
        locked = true; // the lock lands exactly here: after the fill has plaintext, before the cache sees it
        lockAll(); // the registry's real lock funnel (src/stage/caches.ts), the same one keyring.ts calls
        return result;
      },
    };
    const store = createContentStore(backend, () => 1);
    await store.create(presetWithEscrow("p"));
    const before = await store.read("preset", "p");
    armLock = true; // Arm only the patch fill; the initial public read must complete.

    expect(pieceCacheBytes()).toBe(0);

    const patch = {
      head: {
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "preset",
        id: "p",
        body: { name: "P2", prompts: [] },
        original: { testfmt: { raw: null, unmapped: {} } },
      },
    };
    await expect(store.patch("preset", "p", before!.revision, patch)).rejects.toBeInstanceOf(LockedError);

    expect(pieceCacheBytes()).toBe(0); // the gate (piece-cache.ts's setPieceCacheGate) refused the insert
  });

  test("the cache is revalidated on revision too, not version alone: a same-version repair is never trusted", async () => {
    clearPieceCache();
    const d = fresh();
    const cipher = testCipher();
    const backend = sqliteDocumentBackend(d, cipher);
    const store = createContentStore(backend, () => 1);
    await store.save(presetWithEscrow("p"));
    const before = await store.read("preset", "p");

    const headOf = (name: string) => ({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: "p",
      body: { name, prompts: [] },
      original: { testfmt: { raw: null, unmapped: {} } },
    });
    const firstPatch = await store.patch("preset", "p", before!.revision, { head: headOf("P") });
    expect(firstPatch.status).toBe("saved");
    if (firstPatch.status !== "saved") throw new Error("setup failed");
    const cachedRevision = firstPatch.summary.revision;
    const cachedVersion = firstPatch.summary.version;

    // An out-of-band repair - `{ when: "always" }`, tests and repair tools only - rewrites the SAME
    // version number's content directly on the backend, the way a corrupted-cell repair would: the
    // live row's `version` never moves, but its content, and therefore its revision, does.
    const repaired = parseCanonicalEntity({ ...presetWithEscrow("p"), body: { name: "REPAIRED", prompts: [] } });
    const repairedParts = decompose(repaired);
    const repairedRevision = revisionFromParts(repairedParts);
    const repairRow: DocumentRow = { kind: "preset", id: "p", revision: repairedRevision, version: cachedVersion, writeId: (await backend.get("preset", "p"))!.writeId + 1, autosaveStartedAt: null, createdAt: 1, updatedAt: 2 };
    const repairVer: VersionRow = { kind: "preset", id: "p", version: cachedVersion, revision: repairedRevision, savedAt: 2, reason: "save", autosaveStartedAt: null };
    await backend.write(repairRow, repairVer, { when: "always" }, null, { put: repairedParts.map(buildPartText), drop: [] });

    // A client that last fetched the PRE-repair revision asks for a patch from it. Trusting `version`
    // alone would still see the cache's own (pre-repair) version number as fresh, let this patch
    // proceed against stale content, and report "saved" over a repair it silently clobbered.
    // Revalidating on revision too must see the live row moved and refuse instead.
    const result = await store.patch("preset", "p", cachedRevision, { head: headOf("from stale cache") });
    expect(result.status).toBe("stale");
  });
});
