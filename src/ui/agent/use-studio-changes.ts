/** One shell-level SSE owner; piece changes land in the injected summary store. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PieceChangeEvent } from "../../stage/contracts/content-store";
import type { PieceStore, PieceStreamState } from "../_shared/piece-store";
import { isBrowserStudio } from "../_shared/asset-url";
import { exponentialBackoffMs } from "../_shared/backoff";
import { BROWSER_STUDIO_CHANGE_EVENT } from "../../browser-mode";
import { api } from "../api";

export interface StudioChanges {
  readonly version: number;
  readonly seeded: boolean;
  readonly watching: boolean;
  readonly kinds: readonly string[];
  readonly externalVersion: number;
  readonly lockEvent: { readonly state: "locked" | "unlocked"; readonly seq: number } | null;
  readonly sceneTrackers: PieceStreamState["sceneTrackers"];
}

export function usePieceGeneration(pieces: PieceStore): number {
  return useSyncExternalStore((listener) => pieces.subscribeList(listener), () => pieces.getGeneration(), () => 0);
}

/** The canonical list snapshot also changes for a confirmed empty initial inventory. */
export function usePieceList(pieces: PieceStore) {
  return useSyncExternalStore((listener) => pieces.subscribeList(listener), () => pieces.listSnapshot(), () => pieces.listSnapshot());
}

const readInitialInventory = (): ReturnType<typeof api.studioInventory> => api.studioInventory();
const defaultRetryDelay = (failures: number): number => exponentialBackoffMs(failures, { baseMs: 3000, capMs: 60_000 });

export function useStudioChanges(pieces: PieceStore): StudioChanges {
  const version = usePieceGeneration(pieces);
  const state = useSyncExternalStore((listener) => pieces.subscribeList(listener), () => pieces.streamState(), () => ({ seeded: false, watching: false, kinds: [], externalVersion: 0, lockEvent: null, sceneTrackers: null }));
  return { version, ...state };
}

export function useStudioChangeStream(
  pieces: PieceStore,
  connect: (url: string) => EventSource = (url) => new EventSource(url),
  readInventory: typeof api.studioInventory = readInitialInventory,
  retryDelay: (failures: number) => number = defaultRetryDelay,
): void {
  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    let live = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let work = Promise.resolve();
    const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    const syncSnapshot = async (sequence: number, lifetime: number): Promise<void> => {
      if (!live || !pieces.isCurrentLifetime(lifetime)) return;
      if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("piece stream resync cursor is invalid");
      await pieces.reloadInitial(async () => {
        if (!live || !pieces.isCurrentLifetime(lifetime)) throw new DOMException("piece stream closed", "AbortError");
        const inventory = await readInventory();
        if (!live || !pieces.isCurrentLifetime(lifetime)) throw new DOMException("piece stream closed", "AbortError");
        return inventory;
      }, (inventory) => inventory.entities);
      if (live && pieces.isCurrentLifetime(lifetime)) pieces.markSequence(sequence);
    };
    const recover = async (sequence: number, lifetime: number): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!live || !pieces.isCurrentLifetime(lifetime)) return false;
        try { await syncSnapshot(sequence, lifetime); failures = 0; return live && pieces.isCurrentLifetime(lifetime); }
        catch { if (attempt < 2) await delay(exponentialBackoffMs(attempt + 1, { baseMs: 250, capMs: 1000 })); }
      }
      return false;
    };
    const queue = (events: readonly PieceChangeEvent[], onFailure: (sequence: number) => void): void => {
      if (!live) return;
      const lifetime = pieces.captureLifetime();
      work = work.then(async () => {
        for (const event of events) {
          if (!live || !pieces.isCurrentLifetime(lifetime)) return;
          try {
            await pieces.apply(event, async (kind, id) => {
              if (!live || !pieces.isCurrentLifetime(lifetime)) throw new DOMException("piece stream closed", "AbortError");
              const summary = await api.getEntitySummary(kind, id);
              if (!live || !pieces.isCurrentLifetime(lifetime)) throw new DOMException("piece stream closed", "AbortError");
              return summary;
            });
            if (!live || !pieces.isCurrentLifetime(lifetime)) return;
          }
          catch {
            if (!live || !pieces.isCurrentLifetime(lifetime)) return;
            const sequence = Number.isSafeInteger(event.sequence) ? event.sequence : pieces.lastSequence();
            if (!await recover(sequence, lifetime)) { if (live && pieces.isCurrentLifetime(lifetime)) onFailure(sequence); return; }
          }
        }
      }).catch(() => { if (live && pieces.isCurrentLifetime(lifetime)) onFailure(pieces.lastSequence() + 1); });
    };
    if (isBrowserStudio()) {
      const scheduleBrowserRetry = (sequence: number): void => {
        if (!live || retry || failures >= 8) return;
        failures++;
        const lifetime = pieces.captureLifetime();
        retry = setTimeout(() => { retry = null; void recover(sequence, lifetime).then((ok) => { if (!ok && pieces.isCurrentLifetime(lifetime)) scheduleBrowserRetry(sequence); }); }, exponentialBackoffMs(failures, { baseMs: 500, capMs: 8000 }));
      };
      const resync = (sequence: number): void => {
        if (!live || !Number.isSafeInteger(sequence) || sequence < pieces.lastSequence()) return;
        const lifetime = pieces.captureLifetime();
        work = work.then(async () => {
          if (live && pieces.isCurrentLifetime(lifetime) && !await recover(sequence, lifetime) && pieces.isCurrentLifetime(lifetime)) scheduleBrowserRetry(sequence);
        }).catch(() => { if (live && pieces.isCurrentLifetime(lifetime)) scheduleBrowserRetry(sequence); });
      };
      const changed = (event: Event): void => {
        const detail = (event as CustomEvent<{ changes?: unknown; resync?: unknown }>).detail;
        if (typeof detail?.resync === "number") { resync(detail.resync); return; }
        if (Array.isArray(detail?.changes)) queue(detail.changes.filter((row): row is PieceChangeEvent => !!row && typeof row === "object"), (sequence) => {
          if (!live) return;
          const lifetime = pieces.captureLifetime();
          retry = setTimeout(() => { retry = null; void recover(sequence, lifetime).then((ok) => { if (!ok && live && pieces.isCurrentLifetime(lifetime)) scheduleBrowserRetry(sequence); }); }, 1000);
        });
      };
      window.addEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed);
      pieces.setWatching(true);
      return () => { live = false; window.removeEventListener(BROWSER_STUDIO_CHANGE_EVENT, changed); if (retry) clearTimeout(retry); pieces.setWatching(false); };
    }
    let source: EventSource | null = null;
    let everReady = false;
    const scheduleRetry = (): void => {
      if (!live || retry || (!everReady && failures >= 3) || failures > 8) return;
      failures++;
      retry = setTimeout(() => { retry = null; open(); }, retryDelay(failures));
    };
    const resync = (latest: number, connection: EventSource): void => {
      const current = (): boolean => live && source === connection;
      const lifetime = pieces.captureLifetime();
      const failed = (): void => { if (current() && pieces.isCurrentLifetime(lifetime)) { connection.close(); source = null; scheduleRetry(); } };
      work = work.then(async () => {
        if (current() && pieces.isCurrentLifetime(lifetime) && !await recover(latest, lifetime)) failed();
      }).catch(() => { if (current() && pieces.isCurrentLifetime(lifetime)) failed(); });
    };
    const open = (): void => {
      if (!live) return;
      try { source = connectRef.current(`/api/agent/events?after=${pieces.lastSequence()}`); }
      catch { pieces.setWatching(false); scheduleRetry(); return; }
      const connection = source;
      const current = (): boolean => live && source === connection;
      connection.addEventListener("ready", () => { if (current()) { pieces.setWatching(true); failures = 0; everReady = true; } });
      connection.addEventListener("degraded", () => { if (current()) pieces.setWatching(false); });
      // The Story Director's background tracker round ended for a scene (plan 16): the page that shows that scene reads it again.
      connection.addEventListener("scene-trackers", (event) => {
        if (!current()) return;
        try { const e = JSON.parse((event as MessageEvent<string>).data) as { chatId?: unknown; modules?: unknown }; if (typeof e.chatId === "string" && Array.isArray(e.modules)) pieces.setSceneTrackers({ chatId: e.chatId, modules: e.modules as never }); } catch { /* a malformed push is ignored */ }
      });
      connection.addEventListener("lock", () => { if (current()) pieces.setLock("locked"); });
      // A restore replaced the whole library: this page's copies of it are stale, so start over.
      // A window still showing its own restore dialog (backups-dialogs.tsx) reloads when the person is done with it.
      connection.addEventListener("restored", () => { if (current() && !document.querySelector("[data-restore-open]")) window.location.reload(); });
      source.addEventListener("unlock", () => {
        if (!current()) return;
        pieces.setLock("unlocked");
        resync(pieces.lastSequence(), connection);
      });
      source.addEventListener("resync", (event: MessageEvent<string>) => {
        if (!current()) return;
        try {
          const latest = (JSON.parse(event.data) as { latest: number }).latest;
          if (!Number.isSafeInteger(latest) || latest < 0) throw new Error("invalid resync event");
          resync(latest, connection);
        } catch { resync(pieces.lastSequence(), connection); }
      });
      source.addEventListener("piece", (event: MessageEvent<string>) => {
        if (!current()) return;
        try { queue([JSON.parse(event.data) as PieceChangeEvent], () => { if (current()) { connection.close(); source = null; scheduleRetry(); } }); }
        catch { resync(pieces.lastSequence(), connection); }
      });
      source.addEventListener("error", () => {
        if (!current()) return;
        pieces.setWatching(false);
        connection.close();
        source = null;
        scheduleRetry();
      });
    };
    open();
    return () => { live = false; if (retry) clearTimeout(retry); source?.close(); pieces.setWatching(false); };
  }, [pieces, readInventory, retryDelay]);
}

/** Reopen the addressed clean editor when its accepted row identity, revision, or key changes. */
export function useReopenOnStudioChange(
  pieces: PieceStore,
  piece: { readonly id: string; readonly kind: string },
  dirty: boolean,
  reopen: () => void,
): void {
  const snapshot = useSyncExternalStore(
    (listener) => pieces.subscribe(piece.kind, piece.id, listener),
    () => pieces.snapshot(piece.kind, piece.id),
    () => undefined,
  );
  const reopenRef = useRef(reopen);
  reopenRef.current = reopen;
  const key = `${piece.kind}\0${piece.id}`;
  const last = useRef({ key, version: snapshot?.version ?? 0, writeId: snapshot?.writeId ?? 0, revision: snapshot?.revision ?? "", seen: snapshot !== undefined });
  const [owed, setOwed] = useState(false);
  useEffect(() => {
    const current = { key, version: snapshot?.version ?? 0, writeId: snapshot?.writeId ?? 0, revision: snapshot?.revision ?? "", seen: snapshot !== undefined };
    const prior = last.current;
    if (current.key !== prior.key) { last.current = current; setOwed(true); return; }
    if (!snapshot) return;
    if (!prior.seen) { last.current = current; return; }
    if (current.writeId > prior.writeId || current.writeId === prior.writeId && (current.version !== prior.version || current.revision !== prior.revision)) {
      last.current = current;
      setOwed(true);
    }
  }, [key, snapshot]);
  useEffect(() => {
    if (owed && !dirty) { setOwed(false); reopenRef.current(); }
  }, [owed, dirty]);
}
