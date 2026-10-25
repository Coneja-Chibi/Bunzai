/**
 * The health scan's cell checks on the background lane, under a key lease (the same seam the cold
 * piece fill uses): the lease copies the keys for this one job and is released when it ends or when
 * the library locks, which cancels the job. The cells are opened on the worker's thread, so a 20 MB
 * cell never blocks the app. A lane failure is an error, never
 * a fallback to opening the cells on the main thread.
 */
import { LockedError } from "../../crypto/keyring-errors";
import type { KeyLease } from "../../crypto/keyring-lifecycle";
import { runInBackground } from "./background";
import type { MaintenanceJob } from "./maintenance-worker";
import { StaleRepair, type CellsPlan, type MovePlan } from "./health-move";
import type { StageDatabase } from "./database";
import type { TableJob, TableReply } from "./health-page";

/** What the health check needs of the keyring: a copied-key lease, which throws LockedError while locked. */
export interface KeyAccess {
  leaseKeys(): KeyLease;
}

const STALE = "it changed since it was checked";
/** The caller cancelled the job. */
export class LaneCancelled extends Error {
  constructor() {
    super("the check was cancelled");
  }
}

export type CheckLane = (job: TableJob, signal?: AbortSignal) => Promise<TableReply>;

/** One table, however big: a library with millions of rows is still one job per table. */
const LANE_TIMEOUT_MS = 30 * 60_000;

interface LaneInput {
  database: StageDatabase;
  path: string;
  keys: KeyAccess;
}

/** Runs one job under a fresh key lease, as a worker reader the library can cancel; a lock or a cancel is named as itself. */
async function leased(input: LaneInput, purpose: string, make: (keys: { content: Uint8Array; index: Uint8Array }) => MaintenanceJob, signal?: AbortSignal) {
  if (signal?.aborted === true) throw new LaneCancelled();
  const lease = input.keys.leaseKeys();
  const abort = new AbortController();
  const stop = () => abort.abort();
  signal?.addEventListener("abort", stop, { once: true });
  lease.signal.addEventListener("abort", stop, { once: true });
  const reader = input.database.openWorkerReader(purpose, stop);
  try {
    const result = await runInBackground(make(lease), LANE_TIMEOUT_MS, abort.signal, [lease.content.buffer as ArrayBuffer, lease.index.buffer as ArrayBuffer]);
    if (!result.ok) {
      // A lock (or a cancel) ends the lease first: say so as the lock it is, so the scan reports "stopped", not "damaged".
      if (signal?.aborted) throw new LaneCancelled();
      if (!lease.valid()) throw new LockedError();
      if (result.reason.startsWith(STALE)) throw new StaleRepair();
      throw new Error(result.reason);
    }
    return result.data;
  } finally {
    signal?.removeEventListener("abort", stop);
    reader.close();
    lease.release();
  }
}

export function createCheckLane(input: LaneInput): CheckLane {
  if (input.path === ":memory:") throw new Error("the health check reads a library file; an in-memory database has none");
  return async (job, signal) =>
    (await leased(input, "health scan", (k) => ({ kind: "check-table", path: input.path, table: job, content: k.content, index: k.index }), signal)) as TableReply;
}

/** A repair's writes, on the lane (health-move.ts). Throws StaleRepair when a row changed since it was checked. Returns how many rows moved. */
export type RepairLane = (plan: { move: MovePlan } | { cells: CellsPlan }, signal?: AbortSignal) => Promise<number>;

export function createRepairLane(input: LaneInput): RepairLane {
  if (input.path === ":memory:") throw new Error("the health check reads a library file; an in-memory database has none");
  return async (plan, signal) => {
    const out = (await leased(input, "health repair", (k) => ({ kind: "repair", path: input.path, ...plan, content: k.content, index: k.index }), signal)) as { moved: number };
    return out.moved;
  };
}
