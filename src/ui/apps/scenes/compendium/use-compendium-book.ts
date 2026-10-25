/**
 * Reads the open book for the Compendium: one light read per book (no escrow), derived once into a BookModel. It never writes
 * (RoleCall's wing writes chat config just by opening, `CompendiumWingPanel.tsx:206-243`; 04b R4). A stale answer for a book
 * the person has since left is dropped; a book the library no longer has reads as `gone`.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import { ApiHttpError } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { buildModel, type BookModel } from "./compendium-core";

export type BookRead = { state: "none" } | { state: "loading" } | { state: "gone" } | { state: "failed"; why: string } | { state: "ready"; model: BookModel; revision: string };

export function useCompendiumBook(ctx: AppContext, bookId: string | null): BookRead {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const [read, setRead] = useState<BookRead>({ state: bookId ? "loading" : "none" });
  // The library's own change notification for this book (the piece store the wings listen to): a filing, an Undo or a Reconcile
  // that lands re-reads it, so the views show the new entries without reopening the tab. Not polling.
  const [tick, setTick] = useState(0);
  const shown = useRef<string | null>(null);
  useEffect(() => (bookId ? ctx.pieces?.subscribe("lorebook", bookId, () => setTick((n) => n + 1)) : undefined), [ctx.pieces, bookId]);
  useEffect(() => {
    if (!bookId) return setRead({ state: "none" });
    let live = true;
    // A change to the book shown keeps the old views up until the new read arrives; a different book starts from loading.
    if (shown.current !== bookId) setRead({ state: "loading" });
    shown.current = bookId;
    api.current.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(bookId)}`).then((found) => {
      if (!live) return;
      const entity = found.entity as { kind: string; body: LorebookBody };
      setRead(entity?.kind === "lorebook" ? { state: "ready", model: buildModel(entity.body), revision: found.revision } : { state: "gone" });
    }, (e: unknown) => {
      if (live) setRead(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the book could not be read") });
    });
    return () => { live = false; };
  }, [bookId, tick]);
  return read;
}
