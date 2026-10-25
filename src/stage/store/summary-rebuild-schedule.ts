/**
 * When D2's one-time rebuild (summary-rebuild.ts) runs, as opposed to what it does: never competing
 * with boot, and never left stale by a lock. Two rules, mirroring the keyring's own pending-cleanup
 * retry (`crypto/keyring.ts`):
 *
 * - `attempt()` is safe to call at any time: it no-ops while a run is already in flight, once a run
 *   has finished with nothing left stale, or before its own backoff window has elapsed.
 * - A run refused by a lock (`LockedError`, mid-rebuild) or that fails for any other reason is never
 *   the end of it: the next `attempt()` (the caller wires this to "after the next unlock", the same
 *   trigger the keyring's own cleanup retries on) tries again, backing off from a minute to an hour
 *   while the cause persists, so a stale row is never left that way until the next launch.
 *
 * This file only schedules; `ui/library-root.ts` decides WHEN to call `attempt()` (after boot has
 * served its first request, and after every unlock), and `content-store.ts`'s `computeSummaryFor`
 * supplies WHAT a row's summary is.
 */
import { toErrorMessage } from "../../error-message";
import type { DocumentBackend, SummaryInput } from "../contracts/content-store";
import { rebuildSummaries, type RebuildProgress } from "./summary-rebuild";

/** Mirrors keyring.ts's own backoff window. */
const FIRST_RETRY_MS = 60_000;
const MAX_RETRY_MS = 60 * 60_000;

export interface RebuildScheduler {
  /** Runs now unless one is already running, already finished, or still backing off. Never throws. */
  attempt(): void;
  /** True once a run has completed with nothing left stale: further `attempt()` calls are free no-ops. */
  isDone(): boolean;
}

export function createRebuildScheduler(
  backend: DocumentBackend,
  currentDerivedVersion: string,
  compute: (kind: string, id: string) => Promise<{ writeId: number; summary: SummaryInput } | null>,
  onProgress?: (progress: RebuildProgress) => void,
  now: () => number = Date.now,
): RebuildScheduler {
  let running = false;
  let finished = false;
  let nextRetryAt = 0;
  let retryGap = FIRST_RETRY_MS;

  const attempt = () => {
    if (running || finished || now() < nextRetryAt) return;
    running = true;
    rebuildSummaries(backend, currentDerivedVersion, compute, onProgress, now)
      .then(() => {
        finished = true;
        retryGap = FIRST_RETRY_MS;
      })
      .catch((error: unknown) => {
        const reason = toErrorMessage(error);
        console.error(`library: the summary rebuild could not finish (${reason}); will retry after the next unlock`);
        nextRetryAt = now() + retryGap;
        retryGap = Math.min(retryGap * 2, MAX_RETRY_MS);
      })
      .finally(() => {
        running = false;
      });
  };

  return { attempt, isDone: () => finished };
}
