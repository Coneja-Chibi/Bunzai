/**
 * The D2 rebuild step's driver: the same
 * summary function every write uses, run once over every row whose summary is missing or was computed
 * by an older `derivedVersion`, on the background lane, with visible progress. It only ever touches a
 * `DocumentBackend` (D18 rule 1): the actual summary function is injected by `compute`, since only the
 * content-store layer (step 3.2) knows how to read a canonical entity and build its summary.
 */
import type { DocumentBackend, SummaryInput } from "../contracts/content-store";
import { breather } from "./breather";

export interface RebuildProgress {
  done: number;
  total: number;
}

/**
 * Recomputes every live summary that is missing or stamped with a `derivedVersion` other than
 * `currentDerivedVersion`. `compute` reads a live row's parts, assembles them, and returns the fresh
 * summary with the row's own version, or null to leave it "not computed" (an undecodable or damaged
 * row, for instance) - one read per stale row, not two. Never touches the body, revision, or version of any row: `rewriteSummary`'s own version
 * check means a row edited between being listed here and being rewritten simply loses this run's race
 * and is picked up by the next one, never overwritten with a summary of the body it no longer holds.
 */
export async function rebuildSummaries(
  backend: DocumentBackend,
  currentDerivedVersion: string,
  compute: (kind: string, id: string) => Promise<{ writeId: number; summary: SummaryInput } | null>,
  onProgress?: (progress: RebuildProgress) => void,
  now: () => number = Date.now,
): Promise<RebuildProgress> {
  const stale = (await backend.summaries()).rows.filter((s) => s.summary === null || s.derivedVersion !== currentDerivedVersion);
  const progress: RebuildProgress = { done: 0, total: stale.length };
  onProgress?.(progress);
  const breathe = breather();
  for (const s of stale) {
    const computed = await compute(s.kind, s.id);
    if (computed) await backend.rewriteSummary(s.kind, s.id, computed.writeId, computed.summary, now());
    progress.done += 1;
    onProgress?.({ ...progress });
    await breathe();
  }
  return progress;
}
