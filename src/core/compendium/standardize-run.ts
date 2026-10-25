/**
 * What a Standardize run looks like from outside (RoleCall's progress events and result, `lib/compendium/standardize.ts:56-137`):
 * the snapshot the page polls, the request that starts one, and what Revert reports. Types only; the run itself is
 * `studio/compendium-standardize.ts`.
 */
export interface RunLine { at: number; level: "info" | "warn" | "error"; text: string }

export interface RunSnapshot {
  chatId: string;
  bookId: string;
  status: "running" | "cancelling" | "complete" | "cancelled" | "failed";
  startedAt: number;
  finishedAt?: number;
  model: string;
  total: number;
  /** Entries decided so far: converted or left as written. */
  processed: number;
  rewritten: number;
  consumed: number;
  created: number;
  dedup: number;
  failed: number;
  typed: Record<string, number>;
  batches: { done: number; total: number };
  /** What the run is on now, for "Currently processing". */
  current?: string;
  /** Why entries were left as written or only partly converted, bounded. */
  warnings: string[];
  log: RunLine[];
  error?: string;
}

/** How a run cuts the book into batches; the rest of its knobs are the scene's saved Standardize settings. */
export interface StartRequest { by: "entries" | "tokens"; tokenBudget?: number }

export interface RevertResult {
  /** Receipts fully taken back. */
  receipts: number;
  /** Sources typed in place that are classic again. */
  rewrites: number;
  /** Merges into a typed entry that are taken back. */
  merges: number;
  /** Entries the run made that are now retired. */
  splits: number;
  /** Sources the run retired that are back. */
  consumed: number;
  /** What could not be taken back, with why. */
  skipped: string[];
}

export const isActive = (s: Pick<RunSnapshot, "status">): boolean => s.status === "running" || s.status === "cancelling";
