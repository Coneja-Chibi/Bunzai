/**
 * The scene's Standardize runs for the page (RoleCall `hooks/compendium/useStandardize.ts`): what each book's run is doing, the
 * pause on edits while one works, and the four things a person can do (start, stop, dismiss the summary, revert). The server owns
 * the run; this reads it, once on mount and every second only while a run is working (a hidden tab does not poll), so a reopened
 * tab or a second window finds a run in progress. Nothing here writes a book.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import { isActive, type RevertResult, type RunSnapshot, type StartRequest } from "../../../../../core/compendium";
import { toErrorMessage } from "../../../../_shared/error-message";
import { useVisibleInterval } from "../../../../_shared/use-visible-interval";

export interface RevertNote { result?: RevertResult; error?: string }

export interface Standardize {
  run(bookId: string): RunSnapshot | null;
  /** Whether edits are paused: this book's, or any of the scene's with no book named. */
  locked(bookId?: string): boolean;
  /** How many Standardize receipts Revert would take back on this book. */
  revertable(bookId: string): number;
  start(bookId: string, request: StartRequest): Promise<void>;
  cancel(bookId: string): Promise<void>;
  dismiss(bookId: string): Promise<void>;
  revert(bookId: string): Promise<void>;
  reverting(bookId: string): boolean;
  revertNote(bookId: string): RevertNote | null;
  clearRevertNote(bookId: string): void;
  /** Why a start was refused, kept until dismissed. */
  startError(bookId: string): string | null;
  clearStartError(bookId: string): void;
}

const POLL_MS = 1_000;

export function useStandardize(ctx: AppContext, chatId: string): Standardize {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const [runs, setRuns] = useState<ReadonlyMap<string, RunSnapshot>>(new Map());
  const [back, setBack] = useState<Readonly<Record<string, number>>>({});
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [notes, setNotes] = useState<ReadonlyMap<string, RevertNote>>(new Map());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const got = await api.current.standardizeStatus(chatId);
      if (!live.current) return;
      setRuns(new Map(got.runs.map((r) => [r.bookId, r])));
      if (got.revertable) setBack(got.revertable);
    } catch { /* a missed poll is the next poll's */ }
  }, [chatId]);
  useEffect(() => { void reload(); }, [reload]);
  useVisibleInterval(() => void reload(), [...runs.values()].some(isActive) ? POLL_MS : null);

  const put = <T,>(set: (f: (m: ReadonlyMap<string, T>) => ReadonlyMap<string, T>) => void, bookId: string, value: T | null): void =>
    set((m) => { const next = new Map(m); if (value === null) next.delete(bookId); else next.set(bookId, value); return next; });

  return {
    run: (bookId) => runs.get(bookId) ?? null,
    locked: (bookId) => [...runs.values()].some((r) => isActive(r) && (bookId === undefined || r.bookId === bookId)),
    revertable: (bookId) => back[bookId] ?? 0,
    async start(bookId, request) {
      put(setErrors, bookId, null);
      try {
        const { run } = await api.current.startStandardize(chatId, bookId, request);
        if (live.current) { put(setNotes, bookId, null); setRuns((m) => new Map(m).set(bookId, run)); }
      } catch (e) {
        if (live.current) put(setErrors, bookId, toErrorMessage(e, "Standardization could not start"));
      }
    },
    async cancel(bookId) {
      try { const { run } = await api.current.cancelStandardize(chatId, bookId); if (live.current) setRuns((m) => new Map(m).set(bookId, run)); } catch { await reload(); }
    },
    async dismiss(bookId) {
      await api.current.dismissStandardize(chatId, bookId).catch(() => undefined);
      if (live.current) setRuns((m) => { const next = new Map(m); next.delete(bookId); return next; });
    },
    async revert(bookId) {
      setBusy((s) => new Set(s).add(bookId));
      put(setNotes, bookId, null);
      try {
        const result = await api.current.revertStandardize(chatId, bookId);
        if (live.current) put(setNotes, bookId, { result });
      } catch (e) {
        if (live.current) put(setNotes, bookId, { error: toErrorMessage(e, "the revert failed") });
      } finally {
        if (live.current) setBusy((s) => { const next = new Set(s); next.delete(bookId); return next; });
        await reload();
      }
    },
    reverting: (bookId) => busy.has(bookId),
    revertNote: (bookId) => notes.get(bookId) ?? null,
    clearRevertNote: (bookId) => put(setNotes, bookId, null),
    startError: (bookId) => errors.get(bookId) ?? null,
    clearStartError: (bookId) => put(setErrors, bookId, null),
  };
}
