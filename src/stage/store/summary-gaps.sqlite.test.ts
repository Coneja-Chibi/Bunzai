/**
 * Adversarial review finding: `summaries()` used to
 * INNER JOIN `document_summaries` from `documents`, so a live document whose `document_summaries` row
 * is missing entirely - not merely an uncomputed placeholder, the row itself absent - vanished from
 * `list`/`inventory` instead of being reported (spec rule 6: damage is reported, never dropped). Fixed
 * by driving `summaries()` from `documents` with a LEFT JOIN, so every live row is returned; a missing
 * summary reads exactly like an uncomputed one (`summary: null`), which `content-store.ts`'s reader
 * already treats as "compute fresh for this one row" (never a silent drop). `summaryGaps()` names the
 * documents with no row at all, for the background integrity check's repair message (rewriteSummary
 * is UPDATE-only and cannot create the row on its own).
 */
import { describe, expect, test } from "bun:test";
import { countingCipher } from "../../../scripts/perf-count-cipher";
import type { PartChange } from "../contracts/content-store";
import { foldId } from "../contracts/content-store";
import { openStageDatabase, type StageDatabase } from "./sqlite/database";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { MIGRATIONS } from "./sqlite/migrations";
import { testCipher } from "./sqlite/test-support";

const row = (kind = "character", id = "vera") => ({
  kind,
  id,
  revision: "r1",
  version: 1,
  writeId: 1,
  autosaveStartedAt: null,
  createdAt: 1,
  updatedAt: 1,
});
const ver = (kind = "character", id = "vera") => ({
  kind,
  id,
  version: 1,
  revision: "r1",
  savedAt: 1,
  reason: "create" as const,
  autosaveStartedAt: null,
});
/** These tests are about the summary join, never part content: an empty change is enough. */
const noParts: PartChange = { put: [], drop: [] };

/** Deletes a document_summaries row directly, the way the review's reproduction does: a document
 *  whose summary row was never written (a pre-migration leftover, or a partial repair) rather than
 *  one this store itself left stale. */
function dropSummaryRow(d: StageDatabase, cipher: ReturnType<typeof testCipher>, kind: string, id: string): void {
  const k = cipher.index(`${kind}\u0000${foldId(id)}`);
  d.statement("DELETE FROM document_summaries WHERE kind = ? AND id = ?").run(kind, k);
}

describe("summaries(): a live document with no document_summaries row at all is still listed", () => {
  test("summaries() still returns it (as an uncomputed row), never silently drops it", async () => {
    const d = openStageDatabase(":memory:", MIGRATIONS);
    try {
      const cipher = testCipher();
      const backend = sqliteDocumentBackend(d, cipher);
      await backend.write(row(), ver(), { when: "absent" }, { text: "vera's summary", derivedVersion: "1" }, noParts);
      dropSummaryRow(d, cipher, "character", "vera");

      const { rows } = await backend.summaries();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "character", id: "vera", summary: null, derivedVersion: null });
    } finally {
      d.close();
    }
  });

  test("summaryGaps() names it", async () => {
    const d = openStageDatabase(":memory:", MIGRATIONS);
    try {
      const cipher = testCipher();
      const backend = sqliteDocumentBackend(d, cipher);
      await backend.write(row("character", "vera"), ver("character", "vera"), { when: "absent" }, { text: "s", derivedVersion: "1" }, noParts);
      await backend.write(row("lorebook", "mira"), ver("lorebook", "mira"), { when: "absent" }, { text: "s2", derivedVersion: "1" }, noParts);
      dropSummaryRow(d, cipher, "character", "vera");

      expect(await backend.summaryGaps()).toEqual([{ kind: "character", id: "vera" }]);
    } finally {
      d.close();
    }
  });

  test("still never opens documents.body_json - a row with no summary counts the same as a stale one", async () => {
    const d = openStageDatabase(":memory:", MIGRATIONS);
    try {
      const counting = countingCipher(testCipher());
      const backend = sqliteDocumentBackend(d, counting.cipher);
      await backend.write(row("character", "vera"), ver("character", "vera"), { when: "absent" }, { text: "s", derivedVersion: "1" }, noParts);
      await backend.write(row("lorebook", "mira"), ver("lorebook", "mira"), { when: "absent" }, { text: "s2", derivedVersion: "1" }, noParts);
      dropSummaryRow(d, counting.cipher, "character", "vera");
      counting.reset();

      const { rows } = await backend.summaries();
      expect(rows.map((r) => r.id).sort()).toEqual(["mira", "vera"]);
      expect(counting.counts()["documents.body_json"]).toBeUndefined();
    } finally {
      d.close();
    }
  });
});
