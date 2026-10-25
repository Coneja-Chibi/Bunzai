/**
 * Import chat history as the page sees it (`studio/compendium-ingest.ts`): the take's message count and the newest run for the scene,
 * read once and then polled once a second only while a run is going, plus Start, Cancel and Undo. Starting answers at once; the work
 * is on the server, so closing the tab does not stop it and reopening shows where it is. A refusal (a read-only book, a bad range) is
 * said in the status line and nothing starts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { IngestRun } from "../../../../studio/compendium-ingest";
import { toErrorMessage } from "../../../_shared/error-message";
import { useVisibleInterval } from "../../../_shared/use-visible-interval";

export interface Ingest {
  total: number;
  run: IngestRun | null;
  running: boolean;
  start(bookId: string, from: number, to: number): Promise<void>;
  cancel(): Promise<void>;
  undo(): Promise<void>;
}

export function useIngest(ctx: AppContext, chatId: string): Ingest {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const status = useRef(ctx.setStatus);
  status.current = ctx.setStatus;
  const [state, setState] = useState<{ total: number; run: IngestRun | null }>({ total: 0, run: null });
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const got = await api.current.getCompendiumIngest(chatId);
      if (live.current) setState(got);
    } catch { /* the next poll or the next action says what is wrong */ }
  }, [chatId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const running = state.run?.status === "running";
  // Polled only while a run is going and the tab is visible; the work itself is on the server.
  useVisibleInterval(() => void refresh(), running ? 1_000 : null);

  const act = async (fail: string, work: () => Promise<unknown>): Promise<void> => {
    try { await work(); } catch (e) { status.current(`${fail}: ${toErrorMessage(e, "the scene refused it")}`); }
    await refresh();
  };
  return {
    ...state, running,
    start: (bookId, from, to) => act("Could not start the ingest", () => api.current.startCompendiumIngest(chatId, bookId, from, to)),
    cancel: () => act("Could not cancel the ingest", () => (state.run ? api.current.cancelCompendiumIngest(chatId, state.run.id) : Promise.resolve())),
    undo: () => act("Could not undo the ingest", async () => {
      if (!state.run) return;
      const done = await api.current.undoCompendiumIngest(chatId, state.run.id);
      status.current(done.failed.length === 0 ? `Took back ${done.undone} ${done.undone === 1 ? "chunk" : "chunks"}.` : `Took back ${done.undone}; ${done.failed.length} could not be taken back (${done.failed[0]}).`);
    }),
  };
}
