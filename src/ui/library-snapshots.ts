/**
 * Wires the library's snapshot store: where its folder is, what a restore
 * must drop (every cache of the old content), and the hourly schedule the window's process runs. Kit
 * and the MCP server get the store but no schedule, so two processes never write snapshots in turn.
 */
import { join } from "node:path";
import { toErrorMessage } from "./_shared/error-message";
import { lockAll } from "../stage/caches";
import type { CellCipher } from "../stage/crypto/cell-cipher";
import type { StageDatabase } from "../stage/store/sqlite/database";
import { createSnapshotStore, type SnapshotStore } from "../stage/store/sqlite/snapshots";
import type { LibrarySearch } from "./library-search";

/** Who to tell when a restore has replaced the library's content (every open page must reload). */
export function restoreNotifier(): { notify(): void; subscribe(cb: () => void): () => void } {
  const listeners = new Set<() => void>();
  return {
    notify: () => listeners.forEach((cb) => cb()),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

/** The folder beside the library file; its name starts with the file's, which the folder import skips. */
export const snapshotsDir = (studioDir: string): string => join(studioDir, "library.db.snapshots");

export function attachSnapshots(input: { database: StageDatabase; file: string; studioDir: string; cipher: CellCipher; search: () => LibrarySearch | undefined; onRestored?: () => void }): SnapshotStore {
  return createSnapshotStore({
    database: input.database,
    path: input.file,
    dir: snapshotsDir(input.studioDir),
    cipher: input.cipher,
    // Decrypted pieces, derived values, and the search index all describe content that just changed.
    afterRestore: () => { lockAll(); input.search()?.service.invalidate(); input.onRestored?.(); },
  });
}

/** Checks every ten minutes whether an hourly snapshot is due; the first check waits so it never competes with boot. */
export function startSnapshotSchedule(store: SnapshotStore, opts: { firstMs?: number; everyMs?: number } = {}): () => void {
  void store.sweep().catch(() => undefined); // a crashed run's leftovers, once, at start
  const tick = () => { store.takeIfDue().catch((error) => console.warn("library: snapshot failed:", toErrorMessage(error))); };
  const first = setTimeout(() => { tick(); every = setInterval(tick, opts.everyMs ?? 10 * 60_000); /* interval-ok: server process, no renderer or visibility */ every.unref?.(); }, opts.firstMs ?? 30_000);
  first.unref?.();
  let every: ReturnType<typeof setInterval> | undefined;
  return () => { clearTimeout(first); if (every) clearInterval(every); };
}
