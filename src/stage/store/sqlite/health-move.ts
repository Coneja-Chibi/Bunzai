/**
 * The health check's writes, as pure SQL for the background lane: setting rows
 * aside and replacing a damaged cell. A row is copied whole into `set_aside` by SQLite itself (`json_object` over its
 * columns), so a 20 MB cell never becomes a JavaScript string on the main thread, and the copy and the removal are one
 * transaction on the worker's connection. Each row is first compared with the facts the check saw (its key, plain columns
 * and the head of each cell, which changes with every rewrite): a row that changed since it was checked is not touched.
 */
import type { Database, Statement } from "bun:sqlite";
import { valuesOf, whereKey } from "./health-closure";
import type { RowRef } from "./health-types";
import { readFacts, specOf } from "./row-fingerprints";

/** What a repair would write; `expect` maps `table|key` to the facts JSON the check saw. */
export interface MovePlan {
  readonly refs: readonly RowRef[];
  readonly group: string;
  readonly at: number;
  readonly reason: string;
  readonly expect: Readonly<Record<string, string>>;
}
export interface CellsPlan {
  readonly ref: RowRef;
  /** Column to the sealed cell to put there: its text (sealed on the lane for `where`), or null to clear it. */
  readonly cells: Readonly<Record<string, { where: string; text: string } | null>>;
  readonly group: string;
  readonly at: number;
  readonly reason: string;
  readonly expect: Readonly<Record<string, string>>;
}

/** Thrown when a row differs from what the check saw; the repair stops and nothing is written. */
export class StaleRepair extends Error {
  constructor() {
    super("it changed since it was checked; nothing was changed. Check again");
    this.name = "StaleRepair";
  }
}

export const factsKey = (ref: RowRef): string => `${ref.table}|${ref.key}`;
/** The facts of one row as the check saw them (null when it has no spec or is gone). */
export function factsOf(statement: (sql: string) => Statement, ref: RowRef): string | null {
  const spec = specOf(ref.table);
  if (!spec) return null;
  const f = readFacts(statement, spec, ref.key);
  return f ? JSON.stringify(f) : null;
}

/** Every statement here is prepared and finalized at once: one that failed (a trigger's abort) must not keep the connection open. */
function use<T>(db: Database, sql: string, work: (statement: Statement) => T): T {
  const statement = db.prepare(sql);
  try {
    return work(statement);
  } finally {
    statement.finalize();
  }
}
const q = (name: string): string => `"${name.replaceAll('"', '""')}"`;

function keepRow(db: Database, ref: RowRef, plan: { group: string; at: number; reason: string }): boolean {
  const cols = use(db, `PRAGMA table_info(${q(ref.table)})`, (st) => st.all() as { name: string }[]).map((c) => c.name);
  const pairs = cols.map((c) => `'${c.replaceAll("'", "''")}', ${q(c)}`).join(", ");
  return use(
    db,
    `INSERT INTO set_aside (group_id, at, tbl, row_key, row_json, reason) SELECT ?, ?, ?, ?, json_object(${pairs}), ? FROM ${q(ref.table)} WHERE ${whereKey(ref.table)}`,
    (st) => Number(st.run(plan.group, plan.at, ref.table, ref.key, plan.reason, ...valuesOf(ref)).changes) > 0,
  );
}

function checkFacts(db: Database, ref: RowRef, expect: Readonly<Record<string, string>>): void {
  const wanted = expect[factsKey(ref)];
  if (wanted === undefined) return;
  const made: Statement[] = [];
  const now = factsOf((sql) => { const st = db.prepare(sql); made.push(st); return st; }, ref);
  for (const st of made) st.finalize();
  if (now !== wanted) throw new StaleRepair();
}

function inTransaction<T>(db: Database, work: () => T): T {
  db.run("BEGIN IMMEDIATE");
  try {
    const out = work();
    db.run("COMMIT");
    return out;
  } catch (error) {
    // A statement that failed stays active until it is finalized, and would keep the transaction and the file open.
    (db as Database & { clearQueryCache?: () => void }).clearQueryCache?.();
    if (db.inTransaction) db.run("ROLLBACK");
    throw error;
  }
}

/** Moves rows into `set_aside`, children first, in one transaction. Returns how many moved. */
export function moveRowsSql(db: Database, plan: MovePlan): number {
  return inTransaction(db, () => {
    let moved = 0;
    const moveOne = (ref: RowRef): void => {
      checkFacts(db, ref, plan.expect);
      if (!keepRow(db, ref, plan)) return;
      if (ref.table === "documents") {
        const [kind, id] = valuesOf(ref);
        use(db, "INSERT OR IGNORE INTO retired_ids (kind, id) VALUES (?, ?)", (st) => st.run(String(kind), String(id)));
      }
      use(db, `DELETE FROM ${q(ref.table)} WHERE ${whereKey(ref.table)}`, (st) => st.run(...valuesOf(ref)));
      moved++;
    };
    for (const ref of plan.refs) moveOne(ref);
    // Images are shared: only those no remaining link uses go, and that is known once the links are gone.
    const named = new Set(plan.refs.filter((r) => r.table === "blob_refs").map((r) => String(valuesOf(r)[1])));
    for (const key of named) {
      const used = use(db, "SELECT 1 AS n FROM blob_refs WHERE blob = ?", (st) => st.get(key));
      const there = use(db, "SELECT 1 AS n FROM blobs WHERE key = ?", (st) => st.get(key));
      if (!used && there) moveOne({ table: "blobs", key: JSON.stringify([key]) });
    }
    return moved;
  });
}

/** Keeps the whole row aside, then replaces (or clears) the damaged cells. `seal` runs here, under the lease's keys. */
export function replaceCellsSql(db: Database, plan: CellsPlan, seal: (where: string, text: string) => string): void {
  inTransaction(db, () => {
    checkFacts(db, plan.ref, plan.expect);
    if (!keepRow(db, plan.ref, plan)) return;
    const entries = Object.entries(plan.cells);
    const sets = entries.map(([column]) => `${q(column)} = ?`).join(", ");
    const values = entries.map(([, how]) => (how === null ? null : seal(how.where, how.text)));
    use(db, `UPDATE ${q(plan.ref.table)} SET ${sets} WHERE ${whereKey(plan.ref.table)}`, (st) => st.run(...values, ...valuesOf(plan.ref)));
  });
}
