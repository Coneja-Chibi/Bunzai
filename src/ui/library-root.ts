/**
 * The one place the app wires the encrypted library in: the D18 composition root named by
 * It opens `library.db` inside the studio folder, unlocks
 * it with this computer's own copy when there is one, and hands its stores (the pieces and the Studio's
 * own documents) to every Studio store through `addLibrary`. A folder that still holds a plain
 * Hoplight library is imported first; the app never runs on the folder itself. Kit and the
 * MCP server await `openLibrary` before they start; the programs with a window use `createLibrary`,
 * which holds the Studio shut while the library opens (an import in progress included), so the window
 * can come up first and show the load-in.
 *
 * The stores are handed over even while locked: they then refuse every call (LockedError), the
 * server answers 423, and the shell shows the stage door; unlocking later needs no re-wiring.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { attachDerivedPersistence } from "../core/derive/derive";
import { toErrorMessage } from "./_shared/error-message";
import { join, resolve } from "node:path";
import { cellCipher } from "../stage/crypto/cell-cipher";
import { keystoreDeviceVault } from "../stage/crypto/device-vault";
import { createKeyring, type DeviceVault } from "../stage/crypto/keyring";
import { openStageDatabase, type StageDatabase } from "../stage/store/sqlite/database";
import { MIGRATIONS } from "../stage/store/sqlite/migrations";
import { sqliteSessionStore } from "../stage/store/sqlite/kit-sessions";
import { createContentStore, computeSummaryFor } from "../stage/store/content-store";
import { DERIVED_VERSION } from "../stage/store/summary-content";
import { checkSummaryCounts } from "../stage/store/summary-count-check";
import { createRebuildScheduler, type RebuildScheduler } from "../stage/store/summary-rebuild-schedule";
import { sqliteDocumentBackend } from "../stage/store/sqlite/document-backend";
import { sqliteDerivedBackend } from "../stage/store/sqlite/derived-backend";
import { createLibraryAssets } from "./library-assets";
import { createLibrarySearch, type LibrarySearch } from "./library-search";
import { StudioStore } from "../studio/store";
import { createColdReadService } from "../stage/store/cold-read-service";
import { sqliteStateStore } from "../stage/store/sqlite/state-store";
import { sqliteChatStore } from "../stage/store/sqlite-chat-store";
import type { ContentStore, DocumentBackend } from "../stage/contracts/content-store";
import type { StateStore } from "../stage/contracts/state-store";
import type { CellCipher } from "../stage/crypto/cell-cipher";
import { addLibrary, CLAIMED, type LibraryStores } from "../studio/library-content";
import { addLibrarySessions, fileSessionStore, lockedSessionStore } from "../kit/sessions/store";
import { copySessionsIn } from "./library-sessions-copy";
import { attachSnapshots, restoreNotifier, startSnapshotSchedule } from "./library-snapshots";
import type { SnapshotStore } from "../stage/store/sqlite/snapshots";
import { createHealthCheck, type HealthCheck } from "../stage/store/sqlite/health-check";
import { importFolderIntoLibrary, ImportStoppedError, type ImportResult } from "../studio/folder-import";
import { COPYING_FILE, LIBRARY_FILE } from "../studio/fs-backend";
import { readForeignFile } from "../foreign-reader";
import { createIdleLock } from "./library-idle-lock";
import { sweepStaleTemp } from "./temp-sweep";
import type { PieceChangeBatch } from "../stage/contracts/piece-change-contract";
import type { ChatStore } from "../stage/contracts/chat-store";
import { emptyTrash } from "./library-root-trash";
export { emptyTrash } from "./library-root-trash";
export type LibraryState = "unlocked" | "locked";
export interface OpenedLibrary {
  state: LibraryState;
  stateStore?: StateStore;
  keyring: ReturnType<typeof createKeyring>;
  database: StageDatabase;
  /** Rolling snapshots of the library file, and restore. */
  snapshots: SnapshotStore;
  /** The health check: scan, adopt fingerprints, repair. Restore repairs use `snapshots`. */
  health: HealthCheck;
  chats: ChatStore;
  search: LibrarySearch;
  pieceChanges(after: number, limit?: number): Promise<PieceChangeBatch>;
  /** What this start imported from a plain folder, when it did. The load-in screen shows it. */
  imported?: ImportResult;
  /**
   * D2's one-time summary rebuild for this open: `createLibrary`'s `hold()`
   * fires its first `attempt()` on the first request served; absent while locked (nothing to rebuild
   * until there is a key).
   */
  rebuildScheduler?: RebuildScheduler;
  /** Stops handing out the library and closes the database. */
  close(): void;
}
/** One spelling per folder: Windows and macOS paths are not case-sensitive. */
const samePath = (a: string, b: string): boolean => {
  const x = resolve(a);
  const y = resolve(b);
  return process.platform === "linux" ? x === y : x.toLowerCase() === y.toLowerCase();
};
/** True when the folder holds a plain Studio library to import (anything but the library's own files). */
export function holdsPlainLibrary(studioDir: string): boolean {
  if (!existsSync(studioDir)) return false;
  return readdirSync(studioDir).some((name) => !name.startsWith(LIBRARY_FILE) && !name.startsWith("."));
}

const removeDatabaseFiles = (file: string): void => {
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
};
/**
 * The library's two stores over one open database, plus the raw document backend: D2's one-time
 * summary rebuild runs against that same backend, but on its OWN schedule
 * (below), never inline with `createContentStore` here, so building the stores never itself competes
 * with boot.
 */
const storesOf = (database: StageDatabase, cipher: CellCipher, file: string, keyring: ReturnType<typeof createKeyring>): LibraryStores & { backend: DocumentBackend; closeColdReads(): void } => {
  const backend = sqliteDocumentBackend(database, cipher);
  const coldReads = createColdReadService({ database, path: file, cipher, keyring });
  return {
    content: createContentStore(backend, Date.now, { coldFill: coldReads.fill }), state: sqliteStateStore(database, cipher), chats: sqliteChatStore(database, cipher),
    importCompleted: async (pieceCount) => { if (pieceCount > 1000) await database.optimize(); },
    backend, closeColdReads: coldReads.close,
  };
};

/** Progress reported the way this file already reports background maintenance (import, Trash-purge). */
const rebuildProgress = (p: { done: number; total: number }): void => {
  if (p.total === 0) return;
  if (p.done === 0) console.log(`library: rebuilding ${p.total} piece summaries in the background`);
  else if (p.done === p.total) console.log(`library: rebuilt ${p.total} piece summaries`);
};

/**
 * The background integrity check (step 3.3), fired once a rebuild cycle finishes - whether or not it
 * found anything stale, since a document missing its `document_summaries` row entirely never shows up
 * as "stale" (the rebuild's own filter never sees a row that is not there). Never runs on the list
 * path: `onProgress` is the rebuild scheduler's own callback, on the background lane already.
 */
const withCountCheck = (backend: DocumentBackend, onProgress: (p: { done: number; total: number }) => void) => (p: { done: number; total: number }) => {
  onProgress(p);
  if (p.done === p.total) void checkSummaryCounts(backend);
};

/**
 * Never competes with boot: the rebuild's first attempt
 * waits this long after open before it even starts, giving the app room to paint and serve its first
 * requests. `createLibrary`'s `hold()` can fire it sooner, the moment a real request is being served;
 * this timer is only the floor for callers with no request concept (Kit, the MCP server).
 */
const REBUILD_DEFER_MS = 3_000;

type Keyring = ReturnType<typeof createKeyring>;

/**
 * After every successful unlock, also retry an owed rebuild (never left stale by a lock mid-run,
 * matching the keyring's own pending-cleanup retry). `attempt()`
 * itself is always safe to call: it no-ops while a run is in flight, finished, or still backing off.
 *
 * The same three methods are the keyring's only unlock wrappers, so `onUnlock` (optional; absent for
 * every caller but `createLibrary`) rides along here rather than getting its own wrapper. It is how
 * the idle-lock's "first readable" signal and its deadline timer learn of a LATER unlock - one
 * reached from the lock screen, not through `openLibrary`'s own initial open - without polling for
 * it.
 */
function withRebuildRetry(keyring: Keyring, scheduler: RebuildScheduler, onUnlock?: () => void): Keyring {
  return {
    ...keyring,
    async unlock() {
      const ok = await keyring.unlock();
      if (ok) {
        scheduler.attempt();
        onUnlock?.();
      }
      return ok;
    },
    async unlockWithPassword(password: string) {
      await keyring.unlockWithPassword(password);
      scheduler.attempt();
      onUnlock?.();
    },
    async unlockWithWords(words: string, choice: { rememberComputer: boolean }) {
      const result = await keyring.unlockWithWords(words, choice);
      scheduler.attempt();
      onUnlock?.();
      return result;
    },
  };
}

/**
 * The first-start import: builds the library beside the folder under a temporary name, imports every
 * piece and the Studio's own documents, rebuilds it, and only then renames it into place, so an
 * interrupted import can never look like a finished library. The folder is only read.
 */
async function importIn(studioDir: string, vault: DeviceVault, options: OpenOptions): Promise<ImportResult> {
  const building = join(studioDir, COPYING_FILE);
  removeDatabaseFiles(building); // left by an import that was interrupted: start again
  const database = openStageDatabase(building, MIGRATIONS);
  let coldStores: ReturnType<typeof storesOf> | null = null;
  let importKeyring: ReturnType<typeof createKeyring> | null = null;
  let result: ImportResult;
  try {
    importKeyring = createKeyring(database, vault);
    await importKeyring.setup();
    coldStores = storesOf(database, cellCipher(() => importKeyring!.keys()), building, importKeyring);
    result = await importFolderIntoLibrary(studioDir, coldStores, {
      foreign: readForeignFile,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      ...(options.freeSpace ? { freeSpace: options.freeSpace } : {}),
    });
    if (result.pieces > 1000) await database.optimize();
    await database.rebuild();
    coldStores.closeColdReads();
    importKeyring.forget();
  } catch (error) {
    coldStores?.closeColdReads();
    importKeyring?.forget();
    database.close();
    removeDatabaseFiles(building);
    throw error;
  }
  database.close();
  // A WAL left after a clean close would hold writes the renamed file does not: never go live then.
  if (existsSync(`${building}-wal`)) {
    removeDatabaseFiles(building);
    throw new ImportStoppedError("the new library did not close cleanly; your folder is unchanged", "not-clean");
  }
  renameSync(building, join(studioDir, LIBRARY_FILE));
  return result;
}


export interface OpenOptions {
  vault?: DeviceVault;
  /** Progress of a first-start import, piece by piece. */
  onProgress?: (done: number, total: number, file: string) => void;
  /** Free bytes on the studio's disk; tests pass their own. */
  freeSpace?: (dir: string) => number;
  /** Where Kit's old plain transcripts are; tests pass a throwaway folder. */
  sessionsDir?: string;
  /** The keyring's clock and password lock; only tests pass their own. */
  keyring?: Parameters<typeof createKeyring>[2];
  /** CLI inspection skips normal open-time imports, Trash purge, and summary work. */
  skipOpenMaintenance?: boolean;
  /** Fired after every unlock reached through the returned keyring (not the initial auto-unlock
   *  above, which the caller already awaits directly). `createLibrary` is the only caller that
   *  passes one. */
  onUnlock?: () => void;
  onRestored?: () => void;
}

/**
 * Opens the library for a studio folder, importing a plain library in the folder first. When the
 * import cannot run (too little free space), it throws with the reason and the folder is unchanged:
 * the app never falls back to running on the folder.
 */
export async function openLibrary(studioDir: string, options: OpenOptions = {}): Promise<OpenedLibrary> {
  // Every start clears temp files a crashed run stranded (the disk-write list), before anything else.
  sweepStaleTemp();
  const vault = options.vault ?? keystoreDeviceVault;
  const file = join(studioDir, LIBRARY_FILE);
  let imported: ImportResult | undefined;
  if (!existsSync(file) && holdsPlainLibrary(studioDir)) {
    imported = await importIn(studioDir, vault, options);
    console.log(`library: imported ${imported.pieces} pieces into the encrypted library; your folder is unchanged`);
    for (const r of imported.renamed) console.log(`library: kept ${r.kind} "${r.from}" as "${r.to}" (another piece had its id)`);
    for (const d of imported.damaged) console.warn(`library: left out ${d.kind} "${d.id}" (${d.reason})`);
  }
  mkdirSync(studioDir, { recursive: true });
  const database = openStageDatabase(file, MIGRATIONS);
  const keyring = createKeyring(database, vault, options.keyring);
  let state: LibraryState;
  let resourcesClosed = false;
  const releases: (() => void)[] = [() => database.close(), () => keyring.forget()];
  const closeResources = () => {
    if (resourcesClosed) return;
    resourcesClosed = true;
    let failure: unknown;
    for (const release of releases.reverse()) try { release(); } catch (error) { failure ??= error; }
    if (failure !== undefined) throw failure;
  };
  try {
    if ((await keyring.status()).state === "new") {
      await keyring.setup();
      state = "unlocked";
    } else {
      state = (await keyring.unlock()) ? "unlocked" : "locked";
    }
    const cipher = cellCipher(() => keyring.keys());
    const removeDerived = attachDerivedPersistence(sqliteDerivedBackend(database, cipher, file), () => {
      try { cipher.ready(); return true; } catch { return false; }
    });
    releases.push(removeDerived);
    let stores: ReturnType<typeof storesOf> | undefined;
    let assets: ReturnType<typeof createLibraryAssets> | undefined;
    let search: LibrarySearch | undefined;
    let removeStores = () => {};
    let removeSessions = () => {};
    stores = storesOf(database, cipher, file, keyring);
    releases.push(() => stores?.closeColdReads());
    assets = createLibraryAssets(stores.content, cipher, keyring);
    releases.push(() => assets?.close());
    search = createLibrarySearch({ dir: studioDir, store: new StudioStore(studioDir), backend: stores.backend, keyring });
    releases.push(() => search?.close());
    stores.thumbnails = assets.thumbnails;
    const snapshots = attachSnapshots({ database, file, studioDir, cipher, search: () => search, ...(options.onRestored ? { onRestored: options.onRestored } : {}) });
    // Also makes every store transaction sign the rows it changes, so it is attached before any store writes.
    const health = createHealthCheck({ database, cipher, path: file, content: stores.content, keys: keyring, snapshots });
    removeStores = addLibrary((root) => (samePath(root, studioDir) ? stores! : null));
    releases.push(() => removeStores());
    const sessions = sqliteSessionStore(database, cipher, fileSessionStore(options.sessionsDir));
    removeSessions = addLibrarySessions(sessions);
    releases.push(() => removeSessions());
    // D2's one-time summary rebuild is scheduled, never run inline, and remains wired while locked.
    const rebuildScheduler = createRebuildScheduler(
      stores.backend,
      DERIVED_VERSION,
      computeSummaryFor(stores.backend),
      withCountCheck(stores.backend, rebuildProgress),
    );
    const keyringOut = withRebuildRetry(keyring, rebuildScheduler, options.onUnlock);
    if (state === "unlocked" && !options.skipOpenMaintenance) {
      await copySessionsIn(database, sessions, options.sessionsDir);
      await emptyTrash(stores);
      // Kit and MCP callers have no request hook, so arm the deferred floor for them.
      setTimeout(() => rebuildScheduler.attempt(), REBUILD_DEFER_MS).unref?.();
    }
    return {
      state,
      stateStore: stores.state,
      keyring: keyringOut,
      database,
      snapshots,
      health,
      chats: stores.chats,
      search: search!,
      pieceChanges: (after, limit) => stores.backend.pieceChanges(after, limit),
      ...(imported ? { imported } : {}),
      rebuildScheduler,
      close() { closeResources(); },
    };
  } catch (error) {
    try { closeResources(); } catch { /* Preserve the open failure after releasing every resource. */ }
    throw error;
  }
}

/** Where the library is, as the window needs it: the stage door and the load-in screen read this. */
export type LibraryPhase =
  | { phase: "opening" }
  | { phase: "loading-in"; done: number; total: number; recent: string[] }
  | { phase: "failed"; reason: string; noRoom?: boolean }
  | { phase: "locked" }
  | { phase: "unlocked" };

export interface LibraryHandle {
  /** Opens the library (importing a plain folder first). Once; only in the process that serves the window. */
  open(): Promise<OpenedLibrary | null>;
  phase(): Promise<LibraryPhase>;
  /** The open library, or null before it opens or when opening failed. */
  opened(): OpenedLibrary | null;
  /** Activity, for the idle lock. */
  touch(): void;
  /** Keeps the idle lock off while a request runs; call the returned function when it ends. */
  hold(): () => void;
  /**
   * Resolves the first time the library's contents are readable: open and unlocked. Never, when
   * opening failed. Things kept in the library (the settings) wait on it.
   */
  unlocked(): Promise<void>;
  /**
   * Pushed lock/unlock transitions, so a client can drop its status
   * poll for the studio-events stream. Fired once per real transition this handle causes or observes
   * - the idle lock's own deadline, and `/api/library/lock`'s explicit lock, which this handle has no
   * other way to learn of. Returns an unsubscribe.
   */
  onLockChange(cb: (state: "locked" | "unlocked") => void): () => void;
  /** Fired after a restore replaced the library's content, so each open page can reload. Returns an unsubscribe. */
  onRestore(cb: () => void): () => void;
  pieceChanges(after: number, limit?: number): Promise<PieceChangeBatch>;
  /** Announces an explicit `/api/library/lock` (server-library.ts): the one lock path this handle
   *  does not itself call, so it cannot otherwise tell the stream apart from a no-op re-lock. */
  noticeLocked(): void;
  close(): void;
}

/**
 * The library for a window's server. Until the library is open, every Studio store and Kit's
 * transcripts refuse (423): the folder is claimed with no library behind it, and nothing reads the
 * plain folder. If opening
 * fails (an import refused for want of space included), they keep refusing (fail closed) and the
 * phase says why.
 */
export function createLibrary(
  studioDir: string,
  /** `idleCheckMs`: the LONGEST single wait before the idle-lock timer re-checks (test-only; unset
   *  in production, so the real deadline - `idleMinutes`, which can be much larger - is armed
   *  directly, and the timer fires exactly once). See library-idle-lock.ts. */
  options: OpenOptions & { idleCheckMs?: number } = {},
): LibraryHandle {
  const stopWaiting = addLibrarySessions(lockedSessionStore);
  // Held for the handle's life: the open library registers after it and wins; a failed one leaves it.
  const unclaim = addLibrary((root) => (samePath(root, studioDir) ? CLAIMED : null));
  let state: LibraryPhase = { phase: "opening" };
  let library: OpenedLibrary | null = null;
  let stopSnapshots = () => {};
  let opening: Promise<OpenedLibrary | null> | null = null;
  let readable!: () => void;
  const firstReadable = new Promise<void>((resolve) => (readable = resolve));
  let seenReadable = false;
  /** Requests running now: the idle lock never zeroes the key under one. */
  let running = 0;
  /** Fires the deferred summary rebuild (D2) on the first request `hold()` sees, not before. */
  let seenFirstHold = false;
  const restored = restoreNotifier();
  const idleLock = createIdleLock(() => library?.keyring ?? null, () => running, options.idleCheckMs);

  /** Notices the first unlock; checked after opening and on each activity. Never itself pushes a
   *  lock event - a later unlock's push comes from `onUnlock` below, which fires exactly once per
   *  real transition instead of once per touch(). */
  const noticeUnlock = async (): Promise<void> => {
    if (seenReadable || !library) return;
    if ((await library.keyring.status()).state !== "unlocked") return;
    seenReadable = true;
    readable();
  };

  const open = async (): Promise<OpenedLibrary | null> => {
    try {
      library = await openLibrary(studioDir, {
        ...options,
        onProgress: (done, total, file) => {
          // The last few pieces checked, for the load-in screen's running list.
          const recent = [...(state.phase === "loading-in" ? state.recent : []), file].slice(-4);
          state = { phase: "loading-in", done, total, recent };
          options.onProgress?.(done, total, file);
        },
        onRestored: restored.notify,
        onUnlock: () => {
          // A LATER unlock (from the lock screen), reached through the wrapped keyring: the exact
          // transition the idle-lock deadline and the lock-change stream both need, with no poll.
          idleLock.notify("unlocked");
          idleLock.arm();
          void noticeUnlock();
          options.onUnlock?.();
        },
      });
    } catch (error) {
      state = {
        phase: "failed",
        reason: toErrorMessage(error),
        ...(error instanceof ImportStoppedError && error.code === "no-room" ? { noRoom: true } : {}),
      };
      console.error("library: could not open:", state.reason);
      return null;
    }
    stopWaiting();
    // Only this window's process schedules snapshots (they need no key, so a locked library is covered too).
    if (!options.skipOpenMaintenance) stopSnapshots = startSnapshotSchedule(library.snapshots);
    if (library.state === "unlocked") idleLock.notify("unlocked");
    idleLock.arm();
    await noticeUnlock();
    return library;
  };

  return {
    open: () => (opening ??= open()),
    async phase() {
      if (!library) return state;
      return { phase: (await library.keyring.status()).state === "unlocked" ? "unlocked" : "locked" };
    },
    opened: () => library,
    touch() {
      library?.keyring.touch();
      idleLock.arm();
      void noticeUnlock();
    },
    unlocked: () => firstReadable,
    hold() {
      // The first request served ONCE THE LIBRARY IS OPEN: fires the deferred summary rebuild (D2)
      // sooner than its own floor timer. Requests during "opening"/"loading-in" (status polls, the
      // load-in screen) don't count yet, since `library` is still null then; attempt() is safe to
      // call even while locked, so this needs no lock check of its own.
      if (!seenFirstHold && library) {
        seenFirstHold = true;
        library.rebuildScheduler?.attempt();
      }
      running++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        running--;
        // A poll or a gate-refused request never calls touch(); without this, a check that fired
        // while this one was running (and so bailed) would never be re-armed by anything.
        if (running === 0) idleLock.arm();
      };
    },
    onLockChange: (cb) => idleLock.onLockChange(cb),
    onRestore: restored.subscribe,
    pieceChanges: (after, limit) => {
      if (!library) return Promise.reject(new Error("library is unavailable"));
      return library.pieceChanges(after, limit);
    },
    noticeLocked() {
      idleLock.notify("locked");
    },
    close() {
      idleLock.clear();
      stopSnapshots();
      stopWaiting();
      library?.close();
      unclaim();
    },
  };
}
