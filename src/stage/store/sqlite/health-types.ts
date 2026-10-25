/**
 * The health check's shapes: what a scan reports and what a repair
 * is asked to do. A finding names one damaged item in plain words and the repairs on offer; it never
 * carries a cell's contents.
 */

/** A row addressed by table and the JSON array of its declared primary key (never a rowid). */
export interface RowRef {
  readonly table: string;
  readonly key: string;
}

export type FindingCode =
  | "cell-unreadable"
  | "row-changed"
  | "row-missing"
  | "dangling"
  | "parts-missing"
  | "pointer-broken"
  | "file-damaged";

export type RepairKind = "roll-back" | "set-aside" | "re-sign" | "restore-snapshot";

export interface Finding {
  /** Stable for one damage on one row: `${code}|${table}|${key}|${column}`. */
  readonly id: string;
  readonly code: FindingCode;
  readonly row: RowRef;
  /** The damaged column, when one cell is the problem. */
  readonly column?: string;
  /** What is damaged, in words a person knows ("your chat Vera and me", "a character called vera"). */
  readonly item: string;
  /** One plain sentence: what is wrong. */
  readonly cause: string;
  readonly repairs: readonly RepairKind[];
}

export interface ScanReport {
  readonly findings: readonly Finding[];
  /** Rows looked at, by table. */
  readonly checked: Readonly<Record<string, number>>;
  /** Rows that scanned clean but carry no current fingerprint; `adoptFingerprints` signs them. */
  readonly adoptable: readonly RowRef[];
  /** Why signing rows after a restore failed and is still owed (they stay queued until a commit seals), or null. The scan retries it first. */
  readonly sealOwed: string | null;
  /** False when the scan stopped early (cancelled, locked, a failure); then `stoppedAt` says where. */
  readonly complete: boolean;
  readonly stoppedAt?: string;
}

export interface ScanOptions {
  readonly signal?: AbortSignal;
  /** Only these tables (and the structure checks), for re-checking one item after a repair; the file check is skipped. */
  readonly tables?: readonly string[];
  /** Called with a table name as the scan reaches it. */
  readonly onProgress?: (table: string) => void;
}

/** The backups work's snapshot store, as far as the health check uses it (b.md). */
export interface SnapshotRestorer {
  list(): readonly { id: string; kind: string; takenAt: number; bytes: number }[];
  preview(id: string): Promise<unknown>;
  restore(id: string): Promise<unknown>;
}

export type Repair =
  | { readonly kind: "roll-back"; readonly finding: Finding }
  | { readonly kind: "set-aside"; readonly finding: Finding }
  | { readonly kind: "re-sign"; readonly finding: Finding }
  | { readonly kind: "restore-snapshot"; readonly finding: Finding; readonly snapshotId: string };

export interface RepairResult {
  /** True only when the finding is gone after a re-check (rule 13). */
  readonly cleared: boolean;
  /** Plain words: what was done, and what is still wrong if anything. */
  readonly summary: string;
}

/** What a set-aside would move, by table and count, before anything is moved (rule 14). */
export interface SetAsidePreview {
  readonly rows: Readonly<Record<string, number>>;
  /** Plain sentence listing it. */
  readonly summary: string;
}
