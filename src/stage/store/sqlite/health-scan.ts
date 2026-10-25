/**
 * The health scan. Read-only: it pages each covered table
 * along its declared key, has the background lane open every sealed cell and compare each row with
 * its fingerprint (health-page.ts, so no cell is opened on the main thread), then runs the structural
 * queries and, on the background lane, SQLite's own page check. It reports each damaged item in plain words with the repairs on offer, and the clean
 * rows that carry no current fingerprint so `adoptFingerprints` can sign them. It never repairs.
 */
import type { CellCipher } from "../../crypto/cell-cipher";
import { LockedError } from "../../crypto/keyring-errors";
import { breather } from "../breather";
import { runInBackground } from "./background";
import type { StageDatabase } from "./database";
import { CELL_COLUMNS, whereOf } from "./health-cells";
import { LaneCancelled, type CheckLane } from "./health-lane";
import { COLUMN_WORDS, createLabels, tableWords, type Labels } from "./health-labels";
import { rollBackTarget } from "./health-roll-target";
import { structuralHits } from "./health-structure";
import type { Finding, FindingCode, RepairKind, RowRef, ScanOptions, ScanReport } from "./health-types";
import { FP_SPECS, type FpSpec } from "./row-fingerprints";

/** Columns left out of the row a finding is worded from: the words never need a multi-MB cell. */
const HEAVY = "cell";
type Row = Record<string, string | number | null>;

const FILE_ROW: RowRef = { table: "(file)", key: "[]" };

export function createScanner(database: StageDatabase, cipher: CellCipher, path: string, lane: CheckLane) {
  const { statement } = database;
  const labels = createLabels(statement, cipher);

  /** The row at a key as a finding is worded from it, without its heavy cell (it may be 20 MB and is never needed). */
  const lightRow = (table: string, key: string): Row | null => {
    const spec = FP_SPECS.find((s) => s.table === table);
    if (!spec) return null;
    const cols = (statement(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name).filter((c) => c !== HEAVY);
    return (statement(`SELECT ${cols.join(", ")} FROM ${table} WHERE ${spec.key.map((c) => `${c} = ?`).join(" AND ")}`).get(...(JSON.parse(key) as (string | number)[])) as Row | null) ?? null;
  };

  const repairsOf = (code: FindingCode, table: string, row: Row | null): RepairKind[] => {
    if (code === "file-damaged") return ["restore-snapshot"];
    if (code === "row-missing") return ["re-sign", "restore-snapshot"];
    const out: RepairKind[] = [];
    if (row && rollBackTarget(statement, labels, table, row)) out.push("roll-back");
    if (code === "row-changed") out.push("re-sign");
    out.push("set-aside", "restore-snapshot");
    return out;
  };

  const make = (code: FindingCode, table: string, key: string, row: Row | null, cause: string, column?: string): Finding => ({
    id: `${code}|${table}|${key}|${column ?? ""}`,
    code,
    row: { table, key },
    ...(column === undefined ? {} : { column }),
    item: row ? labels.item(table, row) : tableWords(table),
    cause,
    repairs: repairsOf(code, table, row),
  });

  const cellCause = (table: string, column: string): string => {
    const spec = (CELL_COLUMNS[table] ?? []).find((c) => c.column === column);
    const words = COLUMN_WORDS[spec ? whereOf(table, spec) : `${table}.${column}`] ?? COLUMN_WORDS[`${table}.${column}`] ?? "part of this item";
    return `${words} would not open, or does not belong to this row`;
  };

  async function scanTable(spec: FpSpec, checked: Record<string, number>, findings: Finding[], adoptable: RowRef[], breathe: () => Promise<void>, signal?: AbortSignal): Promise<void> {
    const reply = await lane({ table: spec.table }, signal);
    checked[spec.table] = reply.checked;
    for (const r of reply.rows) {
      const row = r.bad.length > 0 || r.fp === "changed" ? lightRow(spec.table, r.rk) : null;
      for (const column of r.bad) findings.push(make("cell-unreadable", spec.table, r.rk, row, cellCause(spec.table, column), column));
      if (r.bad.length > 0) continue;
      if (r.fp === "none" || r.fp === "old") adoptable.push({ table: spec.table, key: r.rk });
      else if (r.fp === "changed") {
        findings.push(make("row-changed", spec.table, r.rk, row, "its contents are not what was saved: a value or a piece of text was changed or came from another row"));
      }
    }
    await breathe();
    // A fingerprint with no row (found on the lane, which holds the keys it needs: the main thread never rereads a table's keys).
    for (const key of reply.missing) findings.push(make("row-missing", spec.table, key, null, "it was saved here and is now gone"));
  }

  /** SQLite's page check, on the lane for a file; inline for an in-memory test database. */
  async function fileCheck(): Promise<Finding | null> {
    let reason: string | null = null;
    if (path === ":memory:") {
      const rows = statement("PRAGMA quick_check").all() as { quick_check: string }[];
      if (!(rows.length === 1 && rows[0]!.quick_check === "ok")) reason = rows.slice(0, 3).map((r) => r.quick_check).join("; ");
    } else {
      const result = await runInBackground({ kind: "quick-check", path });
      if (!result.ok) reason = result.reason;
    }
    if (reason === null) return null;
    return {
      id: `file-damaged|${FILE_ROW.table}|${FILE_ROW.key}|`,
      code: "file-damaged",
      row: FILE_ROW,
      item: "the library file",
      cause: `SQLite found damage in the file's own pages (${reason})`,
      repairs: ["restore-snapshot"],
    };
  }

  /** Words and repairs for a structural hit, naming the row's item. */
  const structuralFinding = (hit: ReturnType<typeof structuralHits>[number]): Finding =>
    make(hit.code, hit.table, hit.key, lightRow(hit.table, hit.key), hit.cause);

  async function scan(options: ScanOptions = {}): Promise<ScanReport> {
    const findings: Finding[] = [];
    const checked: Record<string, number> = {};
    const adoptable: RowRef[] = [];
    const breathe = breather();
    // A seal still owed from a restore is retried first; if it fails again the report says so.
    if (database.sealOwed() !== null) await database.sealNow().catch(() => undefined);
    let at = "the file check";
    try {
      const file = options.tables ? null : await fileCheck();
      if (file) findings.push(file);
      for (const spec of FP_SPECS.filter((s) => !options.tables || options.tables.includes(s.table))) {
        if (options.signal?.aborted) return { findings, checked, adoptable, sealOwed: database.sealOwed(), complete: false, stoppedAt: at };
        at = spec.table;
        options.onProgress?.(spec.table);
        await scanTable(spec, checked, findings, adoptable, breathe, options.signal);
      }
      at = "the structure checks";
      options.onProgress?.(at);
      for (const hit of structuralHits(statement, cipher)) findings.push(structuralFinding(hit));
      return { findings, checked, adoptable, sealOwed: database.sealOwed(), complete: true };
    } catch (error) {
      if (error instanceof LockedError || error instanceof LaneCancelled) return { findings, checked, adoptable, sealOwed: database.sealOwed(), complete: false, stoppedAt: at };
      throw error;
    }
  }

  return { scan, labels: labels as Labels };
}
