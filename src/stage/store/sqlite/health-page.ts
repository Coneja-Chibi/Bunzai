/**
 * One table's cell checks for the health scan: page
 * through the table's rows (or exactly the rows at some keys), open every sealed cell in them, and
 * compare each row with its stored fingerprint. It runs on the background lane (maintenance-worker.ts,
 * under a key lease), so a 20 MB cell is opened off the main thread; the reply is small (keys, damaged
 * column names, a state) and never carries a cell. Each page is read in one read transaction together
 * with its fingerprints, so they agree, and at most one page is held in memory at a time.
 */
import type { Statement } from "bun:sqlite";
import type { CellCipher } from "../../crypto/cell-cipher";
import { damagedColumns } from "./health-cells";
import { factsSql, fingerprintOf, specOf, type FpSpec, type RowFacts } from "./row-fingerprints";

type Stmt = (sql: string) => Statement;
type Row = Record<string, string | number | null> & RowFacts;

const PAGE = 250;
/** Tables whose rows hold a whole part or image: a page of them is read in smaller bites. */
const BIG_CELL_PAGE = 20;

/** The whole table in key order, or exactly the rows at `keys` (`json_array` texts, as a finding names them). */
export interface TableJob {
  readonly table: string;
  readonly keys?: readonly string[];
}
/** Against the stored fingerprint: none, made under an older spec, matching, or not matching. */
export type FpState = "none" | "old" | "same" | "changed";
export interface PageRow {
  rk: string;
  bad: string[];
  fp: FpState;
}
export interface TableReply {
  table: string;
  /** Rows looked at. */
  checked: number;
  /** Rows that already had a stored fingerprint (any spec version). */
  signed: number;
  /** A whole-table job: only the rows that need attention (a damaged cell, or a fingerprint that is not "same"). A keyed job: every row found. */
  rows: PageRow[];
  /** A whole-table job: keys that have a fingerprint and no row. */
  missing: string[];
}

interface PageRead {
  rows: Row[];
  stored: Map<string, { v: number; fp: string }>;
  next: (string | number)[] | null;
}

/** The synchronous half of one page: run it inside a read transaction. */
function readPage(statement: Stmt, spec: FpSpec, at: { after: (string | number)[] | null; limit: number } | { keys: readonly string[] }): PageRead {
  const keySql = spec.key.join(", ");
  let rows: Row[];
  let next: (string | number)[] | null = null;
  if ("keys" in at) {
    const where = spec.key.map((c) => `${c} = ?`).join(" AND ");
    rows = at.keys.flatMap((k) => {
      const row = statement(`SELECT *, ${factsSql(spec)} FROM ${spec.table} WHERE ${where}`).get(...(JSON.parse(k) as (string | number)[]));
      return row ? [row as Row] : [];
    });
  } else {
    const where = at.after ? `WHERE (${keySql}) > (${at.after.map(() => "?").join(", ")})` : "";
    rows = statement(`SELECT *, ${factsSql(spec)} FROM ${spec.table} ${where} ORDER BY ${keySql} LIMIT ${at.limit}`).all(...(at.after ?? [])) as Row[];
    if (rows.length === at.limit) next = spec.key.map((c) => rows[rows.length - 1]![c] as string | number);
  }
  const found = statement("SELECT row_key, v, fp FROM row_fingerprints WHERE tbl = ? AND row_key IN (SELECT value FROM json_each(?))").all(
    spec.table,
    JSON.stringify(rows.map((r) => r.rk)),
  ) as { row_key: string; v: number; fp: string }[];
  return { rows, stored: new Map(found.map((f) => [f.row_key, f])), next };
}

/** `read` runs a synchronous read inside one read transaction (the worker's BEGIN and COMMIT). */
export async function checkTable(read: <T>(work: () => T) => T, statement: Stmt, cipher: CellCipher, job: TableJob): Promise<TableReply> {
  const spec = specOf(job.table);
  if (!spec) throw new Error(`the health check does not cover table ${job.table}`);
  const size = spec.table === "piece_parts" || spec.table === "blobs" ? BIG_CELL_PAGE : PAGE;
  const reply: TableReply = { table: job.table, checked: 0, signed: 0, rows: [], missing: [] };
  const open = async (page: PageRead) => {
    for (const row of page.rows) {
      cipher.ready();
      const bad = await damagedColumns(cipher, spec.table, row);
      const stored = page.stored.get(row.rk);
      const fp: FpState = !stored ? "none" : stored.v < spec.v ? "old" : stored.v > spec.v || stored.fp === fingerprintOf(cipher, spec, row) ? "same" : "changed";
      reply.checked++;
      if (stored) reply.signed++;
      if (job.keys || bad.length > 0 || fp !== "same") reply.rows.push({ rk: row.rk, bad, fp });
    }
  };
  if (job.keys) {
    for (let i = 0; i < job.keys.length; i += size) await open(read(() => readPage(statement, spec, { keys: job.keys!.slice(i, i + size) })));
    return reply;
  }
  for (let after: (string | number)[] | null = null; ; ) {
    const page: PageRead = read(() => readPage(statement, spec, { after, limit: size }));
    await open(page);
    if (!page.next) break;
    after = page.next;
  }
  // Only when some fingerprint was not matched by a row seen above (the common case reads nothing more).
  const signed = (statement("SELECT count(*) AS n FROM row_fingerprints WHERE tbl = ?").get(spec.table) as { n: number }).n;
  if (signed > reply.signed) {
    const present = new Set((statement(`SELECT json_array(${spec.key.join(", ")}) AS rk FROM ${spec.table}`).all() as { rk: string }[]).map((r) => r.rk));
    for (const f of statement("SELECT row_key FROM row_fingerprints WHERE tbl = ?").all(spec.table) as { row_key: string }[]) if (!present.has(f.row_key)) reply.missing.push(f.row_key);
  }
  return reply;
}
