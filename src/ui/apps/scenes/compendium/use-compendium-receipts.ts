/**
 * The scene's Compendium receipts, read from the server (the feed's one source) with the names of the entries they touched. It
 * reads again when the library reports a change to one of the scene's books (a pass that wrote lands, or an Undo or Reconcile), and it
 * never writes. The names come from one light read per book the receipts name; a book that is gone just leaves its entries as ids.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { CompendiumReceipt } from "../../../../stage/contracts/chat-store";
import { readBook } from "../../../../core/compendium";
import { toErrorMessage } from "../../../_shared/error-message";
import type { EntryFacts } from "./activity-core";

export interface Receipts {
  state: "loading" | "ready" | "failed";
  why?: string;
  receipts: CompendiumReceipt[];
  feedClearedAt: number;
  facts: ReadonlyMap<string, EntryFacts>;
  reload(): Promise<void>;
  /** Hides the feed up to now (a watermark; every receipt stays). */
  clear(): Promise<void>;
}

export function useCompendiumReceipts(ctx: AppContext, chatId: string, bookIds: readonly string[] = []): Receipts {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const [state, setState] = useState<Receipts["state"]>("loading");
  const [why, setWhy] = useState<string>();
  const [receipts, setReceipts] = useState<CompendiumReceipt[]>([]);
  const [feedClearedAt, setCleared] = useState(0);
  const [facts, setFacts] = useState<ReadonlyMap<string, EntryFacts>>(new Map());
  const asked = useRef(new Map<string, string>());
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const got = await api.current.listCompendiumReceipts(chatId, { limit: 200 });
      if (!live.current) return;
      setReceipts(got.receipts);
      setCleared(got.feedClearedAt);
      setState("ready");
      // A book is read again when the newest receipt touching it changes, so a name filed a moment ago shows.
      const newest = new Map<string, string>();
      for (const r of got.receipts) for (const w of r.writes) if (!newest.has(w.bookId)) newest.set(w.bookId, r.id);
      for (const [id, receiptId] of newest) {
        if (asked.current.get(id) === receiptId) continue;
        asked.current.set(id, receiptId);
        void api.current.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(id)}`).then((found) => {
          const body = (found.entity as { body?: LorebookBody }).body;
          if (!live.current || !body) return;
          setFacts((had) => new Map([...had, ...readBook(body.entries).map((e): [string, EntryFacts] => [e.id, { name: e.name, type: e.type }])]));
        }, () => undefined);
      }
    } catch (e) {
      if (!live.current) return;
      setWhy(toErrorMessage(e, "the receipts could not be read"));
      setState((s) => (s === "ready" ? s : "failed"));
    }
  }, [chatId]);

  useEffect(() => { void reload(); }, [reload]);
  // A pass, an Undo or a Reconcile that lands changes a book, and the library says so: re-read the receipts then. No polling.
  const watched = bookIds.join(",");
  useEffect(() => {
    const off = watched.split(",").filter(Boolean).map((id) => ctx.pieces?.subscribe("lorebook", id, () => void reload()));
    return () => off.forEach((f) => f?.());
  }, [ctx.pieces, watched, reload]);

  const clear = useCallback(async (): Promise<void> => {
    const done = await api.current.clearCompendiumFeed(chatId);
    if (live.current) setCleared(done.feedClearedAt);
  }, [chatId]);

  return { state, ...(why ? { why } : {}), receipts, feedClearedAt, facts, reload, clear };
}
