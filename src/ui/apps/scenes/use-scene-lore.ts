/**
 * The scene's own lorebook choice (ChatStore rule 20), read and written in one place for the World wing
 * and the Control Booth. Switching, adding or removing a book saves at once, one write after another so a
 * fast second click can never be overtaken by a slow first one; a change that matches what is already
 * showing is not sent. The store answers the recomputed books, and that answer is what is shown.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { SceneLoreBook, SceneLoreChoice, SceneLoreFired } from "../../app-contract-scenes";
import type { AsyncState } from "../../_shared/async-state";
import { toErrorMessage } from "../../_shared/error-message";
import { addBook, choiceFromBooks, removeBook, sameChoice, toggleBook } from "./lore-core";

export type LoreState = AsyncState<{ books: SceneLoreBook[]; lastTurn: { fired: SceneLoreFired[]; totalTokens: number } | null }>;

export interface SceneLore {
  lore: LoreState;
  reload(): Promise<void>;
  toggle(book: SceneLoreBook): void;
  remove(book: SceneLoreBook): void;
  add(bookId: string): void;
}

/** `onLoaded` runs after each (re)load, not after the writes: the World wing picks its first book there. */
export function useSceneLore(ctx: AppContext, chatId: string, onLoaded?: (books: SceneLoreBook[]) => void): SceneLore {
  const [lore, setLore] = useState<LoreState>({ state: "loading" });
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const setStatus = useRef(ctx.setStatus);
  setStatus.current = ctx.setStatus;
  const id = useRef(chatId);
  id.current = chatId;
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;
  const held = useRef(lore);
  held.current = lore;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const queue = useRef(Promise.resolve());

  const reload = useCallback(async () => {
    setLore({ state: "loading" });
    try {
      const result = await api.current.getSceneLore(id.current);
      if (!mounted.current) return;
      setLore({ state: "ready", books: result.books, lastTurn: result.lastTurn });
      loaded.current?.(result.books);
    } catch (e) {
      if (!mounted.current) return;
      setLore({ state: "failed", why: toErrorMessage(e, "the scene's lorebooks could not be read") });
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const send = (next: SceneLoreChoice): void => {
    if (held.current.state === "ready" && sameChoice(next, choiceFromBooks(held.current.books))) return;
    queue.current = queue.current.then(async () => {
      try {
        const result = await api.current.setSceneLore(id.current, next);
        if (mounted.current) setLore({ state: "ready", books: result.books, lastTurn: result.lastTurn });
      } catch (e) {
        if (mounted.current) setStatus.current(`could not change this scene's lorebooks: ${toErrorMessage(e, "the library refused it")}`);
      }
    });
  };
  const books = lore.state === "ready" ? lore.books : [];
  return {
    lore,
    reload,
    toggle: (b) => send(toggleBook(choiceFromBooks(books), b.id, !b.enabled)),
    remove: (b) => send(removeBook(choiceFromBooks(books), b.id)),
    add: (bookId) => send(addBook(choiceFromBooks(books), bookId)),
  };
}
