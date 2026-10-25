/** Disposable derived-cache eviction on the existing SQLite maintenance worker lane. */
import type { Database } from "bun:sqlite";

type Candidate = { family: string; version: string; input_key: string; bytes: number; cost_ms: number; hits: number; last_used: number };
const DECAY_MS = 7 * 24 * 60 * 60 * 1000;

export function trimDerivedRows(db: Database, budgetBytes: number): void {
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 0) throw new Error("invalid derived cache budget");
  const usage = db.query("SELECT bytes FROM derived_usage WHERE singleton = 1");
  const scan = db.query("SELECT family, version, input_key, bytes, cost_ms, hits, last_used FROM derived_rows");
  const remove = db.query("DELETE FROM derived_rows WHERE family = ? AND version = ? AND input_key = ?");
  while ((usage.get() as { bytes: number }).bytes > budgetBytes) {
    const now = Date.now();
    const score = (row: Candidate) => Math.max(0, row.cost_ms) * Math.max(1, row.hits)
      * Math.pow(0.5, Math.max(0, now - row.last_used) / DECAY_MS) / Math.max(1, row.bytes);
    const compare = (a: Candidate, b: Candidate) => score(a) - score(b) || a.last_used - b.last_used;
    const candidates: Candidate[] = [];
    for (const value of scan.iterate()) {
      const row = value as Candidate;
      if (candidates.length === 64 && compare(row, candidates[63]!) >= 0) continue;
      candidates.push(row);
      candidates.sort(compare);
      if (candidates.length > 64) candidates.pop();
    }
    if (!candidates.length) return;
    // The read cursor is finished before taking the write lock; retain at most 64 identities.
    db.run("BEGIN IMMEDIATE");
    try {
      for (const row of candidates) {
        if ((usage.get() as { bytes: number }).bytes <= budgetBytes) break;
        remove.run(row.family, row.version, row.input_key);
      }
      db.run("COMMIT");
    } catch (error) {
      db.run("ROLLBACK");
      throw error;
    }
  }
}
