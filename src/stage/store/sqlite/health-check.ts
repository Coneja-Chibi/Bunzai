/**
 * The health check: one handle over a library's database that scans it,
 * signs the clean rows that have no current fingerprint, previews what a repair would move, and
 * repairs. It is the only thing that writes `set_aside`. It makes the stores' transactions seal row
 * fingerprints (`attachRowFingerprints`) so a repair's own writes are signed like any other.
 */
import type { ContentStore } from "../../contracts/content-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import type { StageDatabase } from "./database";
import { createCheckLane, createRepairLane, type KeyAccess } from "./health-lane";
import { createRepairs } from "./health-repair";
import { createScanner } from "./health-scan";
import type { Finding, Repair, RowRef, RepairResult, ScanOptions, ScanReport, SetAsidePreview, SnapshotRestorer } from "./health-types";
import { attachRowFingerprints, FP_SPECS, signRow, specOf } from "./row-fingerprints";

export interface HealthCheck {
  /** The tables a scan looks at, in order (its progress is counted in these). */
  readonly tables: readonly string[];
  scan(options?: ScanOptions): Promise<ScanReport>;
  /** Signs the rows a scan found clean and unsigned; writes fingerprints only. Returns how many. */
  adoptFingerprints(report: ScanReport): Promise<number>;
  preview(finding: Finding): SetAsidePreview;
  repair(request: Repair): Promise<RepairResult>;
}

export interface HealthCheckDeps {
  readonly database: StageDatabase;
  readonly cipher: CellCipher;
  /** The database file's path, for the page check on the background lane (":memory:" in tests). */
  readonly path: string;
  readonly content: Pick<ContentStore, "versions" | "readVersion" | "restoreVersion">;
  /** The keyring's key lease: the scan opens cells on the background lane under it (health-lane.ts). */
  readonly keys: KeyAccess;
  readonly snapshots?: SnapshotRestorer;
  readonly clock?: () => number;
}

const ADOPT_CHUNK = 200;

export function createHealthCheck(deps: HealthCheckDeps): HealthCheck {
  const { database, cipher } = deps;
  attachRowFingerprints(database, cipher);
  const lane = createCheckLane({ database, path: deps.path, keys: deps.keys });
  const scanner = createScanner(database, cipher, deps.path, lane);
  const repairs = createRepairs({
    database,
    cipher,
    labels: scanner.labels,
    lane,
    repairLane: createRepairLane({ database, path: deps.path, keys: deps.keys }),
    content: deps.content,
    ...(deps.snapshots ? { snapshots: deps.snapshots } : {}),
    clock: deps.clock ?? Date.now,
    recheck: (tables) => scanner.scan(tables ? { tables } : {}),
  });

  async function adoptFingerprints(report: ScanReport): Promise<number> {
    let signed = 0;
    const byTable = new Map<string, RowRef[]>();
    for (const ref of report.adoptable) (byTable.get(ref.table) ?? byTable.set(ref.table, []).get(ref.table)!).push(ref);
    for (const [table, refs] of byTable) {
      const spec = specOf(table);
      if (!spec) continue;
      // Re-read and re-opened first, on the lane: a row damaged since the scan is never signed as it is.
      const { rows } = await lane({ table, keys: refs.map((r) => r.key) });
      const cleanKeys = rows.filter((r) => r.bad.length === 0).map((r) => r.rk);
      for (let i = 0; i < cleanKeys.length; i += ADOPT_CHUNK) {
        await database.patiently(() =>
          database.transaction(() => {
            for (const key of cleanKeys.slice(i, i + ADOPT_CHUNK)) {
              // Only rows still unsigned (or signed under an older spec) and not changed since: a row a
              // store wrote meanwhile was signed by its own transaction and is left alone.
              const stored = database.statement("SELECT v FROM row_fingerprints WHERE tbl = ? AND row_key = ?").get(table, key) as { v: number } | null;
              const queued = database.statement("SELECT 1 AS n FROM fp_dirty WHERE tbl = ? AND row_key = ?").get(table, key);
              if (queued || (stored && stored.v >= spec.v)) continue;
              signRow(database.statement, cipher, spec, key);
              signed++;
            }
          }),
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
    return signed;
  }

  return { tables: FP_SPECS.map((s) => s.table), scan: scanner.scan, adoptFingerprints, preview: repairs.preview, repair: repairs.repair };
}
