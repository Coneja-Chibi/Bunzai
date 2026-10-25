/**
 * The tree the scene stored for one book and what the person does with it (04b Track D3): read once per book, built with the
 * Compendium's model, moved in, and taken back. A page that has no stored layout shows the derived tree. Reading writes nothing; a
 * build or a move is one server call whose answer is the new layout, and a failure is said in the status line and changes nothing
 * (RoleCall's toasts, the status line being this app's). A build also clears Reorganize flags on the server, so the scene is handed
 * back afterwards to show them gone.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { Chat, StoredLayout, StoredTree } from "../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../_shared/error-message";

export interface CompendiumTreeStore {
  layout: StoredLayout | null;
  /** True once the first read answered, so the page does not flash the derived tree before a stored one arrives. */
  loaded: boolean;
  /** What is running now. */
  busy: "build" | "undo" | null;
  /** What the last build had to repair. */
  notes: string[];
  build(): Promise<void>;
  undo(): Promise<void>;
  move(entryId: string, nodeId: string): Promise<boolean>;
}

export function useCompendiumTree(ctx: AppContext, chatId: string, bookId: string | null, onChat?: (chat: Chat) => void): CompendiumTreeStore {
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const status = useRef(ctx.setStatus);
  status.current = ctx.setStatus;
  const chat = useRef(onChat);
  chat.current = onChat;
  const [tree, setTree] = useState<StoredTree | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<CompendiumTreeStore["busy"]>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    setTree(null);
    setNotes([]);
    setLoaded(bookId === null);
    if (bookId === null) return;
    let mine = true;
    api.current.getCompendiumTree(chatId, bookId).then((got) => { if (mine) { setTree(got.tree); setLoaded(true); } }, () => { if (mine) setLoaded(true); });
    return () => { mine = false; };
  }, [chatId, bookId]);

  const run = useCallback(async <T,>(what: CompendiumTreeStore["busy"], fail: string, work: (id: string) => Promise<T>): Promise<T | null> => {
    if (bookId === null) return null;
    if (what) setBusy(what);
    try {
      return await work(bookId);
    } catch (e) {
      status.current(`${fail}: ${toErrorMessage(e, "the scene refused it")}`);
      return null;
    } finally {
      if (what && live.current) setBusy(null);
    }
  }, [bookId]);

  return {
    layout: tree?.layout ?? null, loaded, busy, notes,
    build: async () => {
      const done = await run("build", "Could not build the tree", (id) => api.current.buildCompendiumTree(chatId, id));
      if (!done || !live.current) return;
      setTree(done.tree);
      setNotes(done.notes);
      // The build clears Reorganize flags in the scene's choices; an empty patch hands the scene back as the server holds it now.
      const fresh = await api.current.setSceneCompendium(chatId, {}).catch(() => null);
      if (fresh && live.current) chat.current?.(fresh);
    },
    undo: async () => {
      const done = await run("undo", "Could not take the tree back", (id) => api.current.undoCompendiumTree(chatId, id));
      if (!done || !live.current) return;
      setTree(done.current);
      setNotes([]);
      if (!done.undone) status.current("There is no built tree to take back.");
    },
    move: async (entryId, nodeId) => {
      const done = await run(null, "Could not move the entry", (id) => api.current.moveCompendiumEntry(chatId, id, entryId, nodeId));
      if (done && live.current) setTree(done.tree);
      return done !== null;
    },
  };
}
