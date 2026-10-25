/**
 * Which snapshots survive: the newest one in each of the last 24
 * hours, 7 days, and 4 weeks that have one, plus the last few made just before a restore. A pure
 * function of the list and nothing else, so the edges are tested without a clock or a disk.
 */
export interface Kept { id: string; kind: string; takenAt: number }

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Weeks start Monday UTC: the epoch was a Thursday. */
const bucketOf: Record<"hourly" | "daily" | "weekly", (t: number) => number> = {
  hourly: (t) => Math.floor(t / HOUR),
  daily: (t) => Math.floor(t / DAY),
  weekly: (t) => Math.floor((t - 4 * DAY) / (7 * DAY)),
};
export const KEEP_HOURLY = 24;
export const KEEP_DAILY = 7;
export const KEEP_WEEKLY = 4;
/**
 * Safety copies made before a restore are never thinned by the tiers. The last few are always kept, and so is
 * every one that holds newer data than the oldest kept hourly snapshot: dropping it would lose what the
 * restore set aside while the screen says nothing is lost. That can grow without a cap; the person sees each
 * one's size and removes it by hand (into the Trash, never deleted).
 */
export const KEEP_BEFORE_RESTORE = 3;
/** Copies the person made with Back up now are theirs: never thinned, but capped, and the cap is shown. */
export const KEEP_MANUAL = 10;

/** The ids to keep. Anything not returned may be removed. */
export function snapshotsToKeep(snapshots: readonly Kept[]): Set<string> {
  const keep = new Set<string>();
  const newestFirst = [...snapshots].sort((a, b) => b.takenAt - a.takenAt);
  const regular = newestFirst.filter((s) => s.kind === "auto");
  for (const s of newestFirst) if (s.kind === "manual") keep.add(s.id);
  for (const [tier, limit] of [["hourly", KEEP_HOURLY], ["daily", KEEP_DAILY], ["weekly", KEEP_WEEKLY]] as const) {
    const seen = new Set<number>();
    for (const s of regular) {
      const bucket = bucketOf[tier](s.takenAt);
      if (seen.has(bucket)) continue; // an older one in a bucket that already has its newest
      if (seen.size === limit) break;
      seen.add(bucket);
      keep.add(s.id);
    }
  }
  const kept = regular.filter((s) => keep.has(s.id));
  const oldests = [...kept, ...newestFirst.filter((s) => s.kind === "manual")].map((s) => s.takenAt);
  const oldestKept = oldests.length > 0 ? Math.min(...oldests) : -Infinity; // nothing else kept: every safety copy is the newest data there is
  newestFirst.filter((s) => s.kind === "before-restore").forEach((s, i) => {
    if (i < KEEP_BEFORE_RESTORE || s.takenAt > oldestKept) keep.add(s.id);
  });
  return keep;
}
