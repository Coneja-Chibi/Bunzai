/** Sealed SQLite persistence for Core's rebuildable derived values; misses remain safe Core work. */
import { statSync } from "node:fs";
import type { DerivedPersistence } from "../../../core/derive/derive";
import type { CellCipher } from "../../crypto/cell-cipher";
import type { StageDatabase } from "./database";
import { runInBackground } from "./background";

const MAX_DISK_BYTES = 256 * 1024 * 1024;
const PAYLOAD_CELL = "derived_rows.payload_cell";
type Stored = { family: string; version: string; input_key: string; payload_cell: string; bytes: number; cost_ms: number; hits: number; last_used: number };

export function sqliteDerivedBackend(database: StageDatabase, cipher: CellCipher, libraryFile: string): DerivedPersistence {
  let generation = 0;
  let closed = false;
  let trimming = false;
  let activeFamilies: readonly (readonly [string, string])[] = [];
  let reconcilePending = false;
  const keyOf = (family: string, version: string, revision: string) => cipher.index(`${family}\0${version}\0${revision}`);
  const noWait = <T>(work: () => T): T => {
    database.db.run("PRAGMA busy_timeout = 0");
    try { return work(); }
    finally { database.db.run("PRAGMA busy_timeout = 5000"); }
  };
  const budget = () => Math.min(MAX_DISK_BYTES, Math.max(0, statSync(libraryFile).size * 0.1));
  const reconcileNow = () => {
    if (!reconcilePending) return;
    cipher.ready();
    noWait(() => database.statement(`DELETE FROM derived_rows WHERE NOT EXISTS (
      SELECT 1 FROM json_each(?) active WHERE json_extract(active.value, '$[0]') = derived_rows.family
      AND json_extract(active.value, '$[1]') = derived_rows.version)`).run(JSON.stringify(activeFamilies)));
    reconcilePending = false;
  };
  const trim = (limit: number) => {
    if (trimming || closed || libraryFile === ":memory:") return;
    trimming = true;
    void runInBackground({ kind: "derived-trim", path: libraryFile, budgetBytes: Math.floor(limit * 0.9) }, 30_000)
      .catch(() => { /* Cache maintenance never changes the computed result. */ })
      .finally(() => { trimming = false; });
  };
  return {
    generation: () => generation,
    get(family, version, revision, maxBytes) {
      if (closed || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 16 * 1024 * 1024) return null;
      try {
        cipher.ready();
        reconcileNow();
        const key = keyOf(family, version, revision);
        const cellLimit = maxBytes * 8 + (family.length + version.length) * 8 + 4096;
        const row = noWait(() => database.statement("SELECT family, version, input_key, payload_cell, bytes, cost_ms, hits, last_used FROM derived_rows WHERE family = ? AND version = ? AND input_key = ? AND length(payload_cell) <= ?").get(family, version, key, cellLimit)) as Stored | undefined;
        if (!row) {
          noWait(() => database.statement("DELETE FROM derived_rows WHERE family = ? AND version = ? AND input_key = ? AND length(payload_cell) > ?").run(family, version, key, cellLimit));
          return null;
        }
        if (!Number.isSafeInteger(row.bytes) || row.bytes < 0 || !Number.isFinite(row.cost_ms) || row.cost_ms < 0 || !Number.isSafeInteger(row.hits) || row.hits < 1 || !Number.isSafeInteger(row.last_used)) throw new Error("bad derived row metadata");
        const envelope = JSON.parse(cipher.open(PAYLOAD_CELL, row.payload_cell)) as [string, string, string, string];
        if (!Array.isArray(envelope) || envelope.length !== 4 || envelope[0] !== family || envelope[1] !== version || envelope[2] !== key || typeof envelope[3] !== "string") throw new Error("derived row binding mismatch");
        if (envelope[3].length > maxBytes || Buffer.byteLength(envelope[3], "utf8") > maxBytes) throw new Error("oversized derived row");
        try { noWait(() => database.statement("UPDATE derived_rows SET hits = hits + 1, last_used = ? WHERE family = ? AND version = ? AND input_key = ?").run(Date.now(), family, version, key)); } catch { /* A busy cache statistic never delays a hit. */ }
        return { value: envelope[3], bytes: row.bytes, costMs: row.cost_ms, hits: Math.max(1, row.hits + 1), lastUsed: Date.now() };
      } catch (error) {
        if (/SQLITE_BUSY/.test(String((error as { code?: unknown })?.code ?? ""))) return null;
        throw error;
      }
    },
    reconcile(families) {
      if (closed) return;
      activeFamilies = [...families];
      reconcilePending = true;
      try { reconcileNow(); } catch { /* Locked or busy startup retries before the next lookup/write. */ }
    },
    set(family, version, revision, value, expectedGeneration) {
      if (closed || expectedGeneration !== generation || value.bytes < 0 || !Number.isFinite(value.costMs) || value.hits < 1) return false;
      try {
        cipher.ready();
        reconcileNow();
        const key = keyOf(family, version, revision);
        const envelope = JSON.stringify([family, version, key, value.value]);
        const payload = cipher.seal(PAYLOAD_CELL, envelope);
        const now = Date.now();
        const limit = budget();
        const bytes = value.bytes + payload.length + family.length + version.length + key.length + 96;
        return noWait(() => database.transaction(() => {
          const usage = database.statement("SELECT bytes FROM derived_usage WHERE singleton = 1").get() as { bytes: number };
          const prior = database.statement("SELECT bytes FROM derived_rows WHERE family = ? AND version = ? AND input_key = ?").get(family, version, key) as { bytes: number } | null;
          if (usage.bytes - (prior?.bytes ?? 0) + bytes > limit) {
            trim(limit);
            return false;
          }
          database.statement(`INSERT INTO derived_rows (family, version, input_key, payload_cell, bytes, cost_ms, hits, last_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (family, version, input_key) DO UPDATE SET
            payload_cell = excluded.payload_cell, bytes = excluded.bytes, cost_ms = excluded.cost_ms,
            hits = excluded.hits, last_used = excluded.last_used`).run(family, version, key, payload, bytes, value.costMs, value.hits, now);
          return Boolean(database.statement("SELECT 1 AS present FROM derived_rows WHERE family = ? AND version = ? AND input_key = ?").get(family, version, key));
        }));
      } catch (error) {
        if (/SQLITE_BUSY/.test(String((error as { code?: unknown })?.code ?? ""))) return false;
        return false;
      }
    },
    delete(family, version, revision) {
      if (closed) return;
      try { cipher.ready(); noWait(() => database.statement("DELETE FROM derived_rows WHERE family = ? AND version = ? AND input_key = ?").run(family, version, keyOf(family, version, revision))); } catch { /* Rebuild remains correct if cleanup is busy or locked. */ }
    },
    stats() {
      if (closed) return [];
      cipher.ready();
      return noWait(() => database.statement("SELECT family || '@' || version AS family, COUNT(*) AS rows, SUM(bytes) AS bytes, AVG(cost_ms) AS meanCostMs FROM derived_rows GROUP BY family, version").all()) as { family: string; rows: number; bytes: number; meanCostMs: number }[];
    },
    clear() {
      if (closed) return 0;
      cipher.ready();
      return noWait(() => database.transaction(() => { const count = database.statement("SELECT COUNT(*) AS n FROM derived_rows").get() as { n: number }; database.statement("DELETE FROM derived_rows").run(); return count.n; }));
    },
    lock() { generation++; },
    close() { generation++; closed = true; },
  };
}
