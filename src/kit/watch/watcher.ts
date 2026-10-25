/** Debounced polling shell for process-local, read-only studio change watching. */
import { watch, type FSWatcher } from "node:fs";
import type { EntitySummary } from "../bridge";
import { diffStudio, type StudioChange } from "./watch-core";

export type WatchScheduler = (
  poll: () => Promise<void>,
  intervalMs: number,
) => () => void;

export type StudioWatchSource = (
  onChange: (change: StudioChange) => void,
) => () => void;

const scheduleInterval: WatchScheduler = (poll, intervalMs) => {
  const timer = setInterval(() => void poll(), intervalMs);
  return () => clearInterval(timer);
};

/** Collapse a burst of writes into one poll; an atomic save is several fs events (same figure as
 *  studio-events.ts's own debounce, the browser side of this same mechanism). */
const QUIET_MS = 150;

/**
 * A change on disk polls once, rather than polling on a fixed beat whether or not the studio has
 * moved. Falls back to the plain interval if the recursive watch is
 * refused - a network share, some containers - the one case studio-events.ts also degrades on.
 */
export function scheduleFsWatch(studioDir: string): WatchScheduler {
  return (poll, intervalMs) => {
    let quiet: ReturnType<typeof setTimeout> | null = null;
    let watcher: FSWatcher | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;

    const runSoon = (): void => {
      if (quiet) clearTimeout(quiet);
      quiet = setTimeout(() => {
        quiet = null;
        void poll();
      }, QUIET_MS);
    };
    const useFallback = (): void => {
      fallback ??= setInterval(() => void poll(), intervalMs);
    };

    try {
      watcher = watch(studioDir, { recursive: true }, runSoon);
      watcher.on("error", () => {
        watcher?.close();
        watcher = null;
        useFallback();
      });
    } catch {
      useFallback();
    }

    return () => {
      watcher?.close();
      if (quiet) clearTimeout(quiet);
      if (fallback) clearInterval(fallback);
    };
  };
}

/**
 * The polling loop, kept separate from the differ it drives.
 *
 * Its whole value is three details that are easy to get subtly wrong. `running` skips a tick rather
 * than stacking overlapping reads. `closed` is re-checked AFTER the await, so a stopped watcher
 * cannot deliver one last change into a torn-down view. A throw is swallowed, so a half-written file
 * costs one tick instead of the watcher. The snapshot advances even on an empty diff, which is what
 * stops one change being reported on every tick forever.
 */
function watchPolling<Snapshot, Change>({
  initial,
  read,
  diff,
  onChange,
  intervalMs,
  schedule = scheduleInterval,
}: {
  initial: Snapshot;
  read: () => Promise<Snapshot>;
  diff: (before: Snapshot, after: Snapshot) => Change | null;
  onChange: (after: Snapshot, change: Change) => void;
  intervalMs: number;
  schedule?: WatchScheduler;
}): () => void {
  let previous = initial;
  let running = false;
  let closed = false;
  const poll = async (): Promise<void> => {
    if (running || closed) return;
    running = true;
    try {
      const after = await read();
      if (closed) return;
      const change = diff(previous, after);
      previous = after;
      if (change) onChange(after, change);
    } catch {
      // A half-written or temporarily unreadable studio is ignored until the next bounded poll.
    } finally {
      running = false;
    }
  };
  const unschedule = schedule(poll, intervalMs);
  return () => {
    closed = true;
    unschedule();
  };
}

export function watchStudio({
  initial,
  list,
  onChange,
  intervalMs = 1200,
  schedule = scheduleInterval,
}: {
  initial: readonly EntitySummary[];
  list: () => Promise<EntitySummary[]>;
  onChange: (change: StudioChange) => void;
  intervalMs?: number;
  schedule?: WatchScheduler;
}): () => void {
  return watchPolling<readonly EntitySummary[], StudioChange>({
    initial: [...initial],
    read: list,
    diff: diffStudio,
    onChange: (_after, change) => onChange(change),
    intervalMs,
    schedule,
  });
}

