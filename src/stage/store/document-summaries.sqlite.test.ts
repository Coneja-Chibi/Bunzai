/**
 * Sealed piece summaries: the
 * `document_summaries` / `grave_summaries` tables (migration 17), and the SQLite DocumentBackend's
 * promise that a summary is written and moved atomically with the row it describes, so it can never
 * be missing or stale relative to it. `summaries()` never opens `documents.body_json`, proven with the
 * counting cipher `scripts/perf-count-cipher.ts` also uses for the later open-count gates.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { countingCipher } from "../../../scripts/perf-count-cipher";
import type { DocumentRow, PartChange, VersionRow } from "../contracts/content-store";
import { openStageDatabase, type StageDatabase } from "./sqlite/database";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { MIGRATIONS } from "./sqlite/migrations";
import { freshDatabase, testCipher } from "./sqlite/test-support";

const open: StageDatabase[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
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
/** These tests are about summary/row mechanics, never part content, so an empty change is enough. */
const noParts: PartChange = { put: [], drop: [] };

test("the migration adds document_summaries and grave_summaries to an existing database file", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "bunraku-summaries-"));
  try {
    const path = join(dir, "bunraku.db");
    openStageDatabase(path, MIGRATIONS.slice(0, 16)).close();
    const reopened = openStageDatabase(path, MIGRATIONS);
    try {
      const tables = (reopened.db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
        (t) => t.name,
      );
      expect(tables).toContain("document_summaries");
      expect(tables).toContain("grave_summaries");
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("migration 17 backfills a placeholder summary for a document that already existed", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "bunraku-summaries-backfill-"));
  try {
    const path = join(dir, "bunraku.db");
    const cipher = testCipher();
    // A document written by code before migration 17 existed: no document_summaries row can exist for it yet.
    const pre = openStageDatabase(path, MIGRATIONS.slice(0, 16));
    const k = cipher.index("character\u0000vera");
    pre
      .statement("INSERT INTO documents (kind, id, id_cell, body_json, revision, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        "character",
        k,
        cipher.seal("documents.id_cell", "vera"),
        cipher.seal("documents.body_json", '{"v":1}'),
        cipher.seal("documents.revision", "r1"),
        1,
        1,
        1,
      );
    pre.close();

    // Capped at 17, not the full list: migration 18 renames the piece tables to legacy ones and
    // starts `documents` over empty, so this pre-existing
    // row would simply vanish under the full migration list. This test is about 17's own backfill
    // step in isolation, not about what 18 does to data that predates it.
    const reopened = openStageDatabase(path, MIGRATIONS.slice(0, 17));
    try {
      // Inspect migration 17 directly: the current backend requires later receipt migrations.
      expect(reopened.statement("SELECT kind, id, summary_cell, revision_cell, derived_version, updated_at FROM document_summaries").all()).toEqual([
        { kind: "character", id: k, summary_cell: null, revision_cell: null, derived_version: null, updated_at: 1 },
      ]);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("write keeps the summary in the same transaction as the row", () => {
  test("a write with no summary records 'not computed', never a missing row", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, null, noParts);
    expect(await backend.summaries()).toEqual({
      rows: [{ kind: "character", id: "vera", liveRevision: "r1", version: 1, writeId: 1, summary: null, revision: null, derivedVersion: null, updatedAt: 1 }],
      quarantined: [],
    });
  });

  test("a write with a summary seals it and stamps the row's own revision", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "a tagline", derivedVersion: "1" }, noParts);
    expect(await backend.summaries()).toEqual({
      rows: [{ kind: "character", id: "vera", liveRevision: "r1", version: 1, writeId: 1, summary: "a tagline", revision: "r1", derivedVersion: "1", updatedAt: 1 }],
      quarantined: [],
    });
  });

  test("a later write without a summary clears the prior one back to 'not computed'", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "first", derivedVersion: "1" }, noParts);
    await backend.write(
      row({ revision: "r2", version: 2, updatedAt: 2 }),
      ver({ version: 2, revision: "r2" }),
      { when: "writeId", expected: 1 },
      null,
      noParts,
    );
    expect((await backend.summaries()).rows[0]).toMatchObject({ summary: null, revision: null, derivedVersion: null, updatedAt: 2 });
  });

  test("a failing summary write leaves neither the document row, its version, nor a partial summary", async () => {
    const d = fresh();
    const backend = sqliteDocumentBackend(d, testCipher());
    d.db.run("CREATE TRIGGER boom_summary BEFORE INSERT ON document_summaries WHEN NEW.derived_version = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(backend.write(row(), ver(), { when: "absent" }, { text: "s", derivedVersion: "boom" }, noParts)).rejects.toThrow("boom");
    expect(await backend.get("character", "vera")).toBeNull();
    expect((await backend.versions("character", "vera")).rows).toEqual([]);
    expect((await backend.summaries()).rows).toEqual([]);
  });

  test("a failing row write never reaches the summary write either", async () => {
    const d = fresh();
    const backend = sqliteDocumentBackend(d, testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "first", derivedVersion: "1" }, noParts);
    d.db.run("CREATE TRIGGER boom BEFORE INSERT ON document_versions WHEN NEW.version = 2 BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(
      backend.write(
        row({ revision: "r2", version: 2 }),
        ver({ version: 2, revision: "r2" }),
        { when: "writeId", expected: 1 },
        { text: "second", derivedVersion: "2" },
        noParts,
      ),
    ).rejects.toThrow("boom");
    expect((await backend.summaries()).rows[0]).toMatchObject({ summary: "first", derivedVersion: "1" });
  });
});

describe("summaries move atomically with the row: bury, unbury, purge", () => {
  test("bury moves the summary into the grave, and unbury brings it home", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "hello", derivedVersion: "1" }, noParts);
    await backend.bury("character", "vera", "g1", 10);
    expect((await backend.summaries()).rows).toEqual([]);
    expect(await backend.unbury("g1")).toBe(true);
    expect((await backend.summaries()).rows[0]).toMatchObject({ id: "vera", summary: "hello", derivedVersion: "1" });
  });

  test("purge removes the grave's summary with it", async () => {
    const d = fresh();
    const backend = sqliteDocumentBackend(d, testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "hello", derivedVersion: "1" }, noParts);
    await backend.bury("character", "vera", "g1", 10);
    expect((d.db.query("SELECT count(*) AS n FROM grave_summaries").get() as { n: number }).n).toBe(1);
    expect(await backend.purgeBefore(100)).toBe(1);
    expect((d.db.query("SELECT count(*) AS n FROM grave_summaries").get() as { n: number }).n).toBe(0);
  });

  test("a bury that fails partway leaves the summary live with its row", async () => {
    const d = fresh();
    const backend = sqliteDocumentBackend(d, testCipher());
    await backend.write(row(), ver(), { when: "absent" }, { text: "hello", derivedVersion: "1" }, noParts);
    d.db.run("CREATE TRIGGER boom BEFORE DELETE ON documents BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(backend.bury("character", "vera", "g1", 10)).rejects.toThrow("boom");
    expect((await backend.summaries()).rows[0]).toMatchObject({ summary: "hello" });
    expect(await backend.graves()).toEqual({ rows: [], quarantined: [] });
  });
});

describe("rewriteSummary: the D2 rebuild step's backend primitive", () => {
  test("fills a summary only while the row is still at the write identity read", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, null, noParts);
    expect(await backend.rewriteSummary("character", "vera", 1, { text: "computed", derivedVersion: "1" }, 5)).toBe(true);
    expect((await backend.summaries()).rows[0]).toMatchObject({ summary: "computed", derivedVersion: "1", revision: "r1", updatedAt: 5 });

    // The row moves on without a fresh summary (today's content-store, before 3.2 lands).
    await backend.write(row({ revision: "r2", version: 2 }), ver({ version: 2, revision: "r2" }), {
      when: "writeId",
      expected: 1,
    }, null, noParts);
    expect((await backend.summaries()).rows[0]?.summary).toBeNull();

    // A rebuild that read the row at the old version loses the race and changes nothing.
    expect(await backend.rewriteSummary("character", "vera", 1, { text: "stale", derivedVersion: "1" }, 6)).toBe(false);
    expect((await backend.summaries()).rows[0]?.summary).toBeNull();

    // A rebuild that reads the current version fills it, and stamps the row's current revision.
    expect(await backend.rewriteSummary("character", "vera", 2, { text: "filled", derivedVersion: "1" }, 7)).toBe(true);
    expect((await backend.summaries()).rows[0]).toMatchObject({ summary: "filled", revision: "r2", derivedVersion: "1", updatedAt: 7 });
  });

  test("never touches the body, revision, or version of the row itself", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    await backend.write(row(), ver(), { when: "absent" }, null, noParts);
    await backend.rewriteSummary("character", "vera", 1, { text: "computed", derivedVersion: "1" }, 5);
    expect(await backend.get("character", "vera")).toEqual(row());
  });

  test("false, changing nothing, for a row that was never written", async () => {
    const backend = sqliteDocumentBackend(fresh(), testCipher());
    expect(await backend.rewriteSummary("character", "ghost", 1, { text: "x", derivedVersion: "1" }, 1)).toBe(false);
    expect((await backend.summaries()).rows).toEqual([]);
  });
});

describe("summaries() never opens a body cell", () => {
  test("counted opens touch only id and summary cells, never documents.body_json", async () => {
    const d = fresh();
    const counting = countingCipher(testCipher());
    const backend = sqliteDocumentBackend(d, counting.cipher);
    await backend.write(row({ id: "vera" }), ver({ id: "vera" }), { when: "absent" }, { text: "vera's summary", derivedVersion: "1" }, noParts);
    await backend.write(row({ id: "mira", kind: "lorebook" }), ver({ id: "mira", kind: "lorebook" }), { when: "absent" }, null, noParts);
    counting.reset();

    const { rows } = await backend.summaries();

    expect(rows.map((r) => r.id).sort()).toEqual(["mira", "vera"]);
    const counts = counting.counts();
    expect(counts["documents.body_json"]).toBeUndefined();
    expect(counts["document_summaries.summary_cell"]?.opens).toBe(1); // only vera has one
    expect(counts["documents.id_cell"]?.opens).toBe(2);
  });

  test("the kind-scoped branch never opens a body cell either", async () => {
    const d = fresh();
    const counting = countingCipher(testCipher());
    const backend = sqliteDocumentBackend(d, counting.cipher);
    await backend.write(row({ id: "vera" }), ver({ id: "vera" }), { when: "absent" }, { text: "vera's summary", derivedVersion: "1" }, noParts);
    await backend.write(row({ id: "mira", kind: "lorebook" }), ver({ id: "mira", kind: "lorebook" }), { when: "absent" }, null, noParts);
    counting.reset();

    const { rows } = await backend.summaries("character");

    expect(rows.map((r) => r.id)).toEqual(["vera"]);
    expect(counting.counts()["documents.body_json"]).toBeUndefined();
  });
});
