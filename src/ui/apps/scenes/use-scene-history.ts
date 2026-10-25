/**
 * Durable undo and Edit history for the scene page (ChatStore rule 5; approved wireframe
 * rc-port/scene-history.html). Opening a bubble's More reads that version's earlier texts, at the version
 * the page shows, so the menu can say how many there are. Undo last edit and Restore both save through the
 * ordinary edit (the page's editSceneMessage), so the text they replace joins the history and either can
 * be undone; the toast's Redo is one more such edit. Nothing here keeps text of its own beyond the list
 * being shown: a scene reload (any version change) drops it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "../../_shared/error-message";
import type { ScenesApi } from "../../app-contract-scenes";
import type { OpenScene } from "../../../studio/scenes";
import { selectedSwipe } from "./use-scene-swipe-preview";
import { undoTarget } from "./scene-history-core";
import type { HistoryView } from "./scene-history";

interface Loaded extends HistoryView { id: string; swipeId: string; version: number }
interface ToastState { message: string; id: string; swipeId: string; redoText: string }

const stale = (e: unknown): boolean => /\bversion\b|409/i.test(toErrorMessage(e));

export function useSceneHistory(o: {
  api: Pick<ScenesApi, "getSceneSwipeHistory" | "editSceneMessage">;
  scene: OpenScene | null;
  busy: boolean;
  load(): void;
  setStatus(text: string): void;
  setMenu(menu: { id: string; which: "more" | "delete" | "history" } | null): void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const live = useRef(o);
  live.current = o;
  const reading = useRef(0);
  const version = o.scene?.branchVersion;
  // A version change (any save, cut, take switch) makes what was read stale: show nothing rather than guess.
  const view = loaded && loaded.version === version ? loaded : null;
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => { setToast((t) => (t ? null : t)); }, [o.scene?.chat.activeBranchId]);

  /** More opened on a message: read its earlier texts. */
  const read = useCallback((id: string): void => {
    const { api, scene, load, setStatus } = live.current;
    const m = scene?.messages.find((x) => x.id === id);
    const swipe = m && selectedSwipe(m);
    if (!scene || !m || !swipe) return;
    const ticket = ++reading.current;
    api.getSceneSwipeHistory({ chatId: scene.chat.id, branchId: scene.chat.activeBranchId, messageId: id, index: m.current, expectedVersion: scene.branchVersion }).then((r) => {
      if (ticket === reading.current) setLoaded({ id, swipeId: r.swipeId, version: scene.branchVersion, current: swipe.content, texts: r.texts });
    }, (e: unknown) => {
      if (ticket !== reading.current) return;
      if (stale(e)) {
        setStatus("the scene changed in another window; it has been reloaded");
        load();
      } else setStatus(`could not read the edit history: ${toErrorMessage(e)}`);
    });
  }, []);

  /** One edit that puts `content` on the version; the page reloads either way, so a stale write shows the truth. */
  const apply = useCallback(async (id: string, swipeId: string, content: string): Promise<boolean> => {
    const { api, scene, busy, load, setStatus, setMenu } = live.current;
    setMenu(null);
    if (!scene) return false;
    if (busy) {
      setStatus("wait for the reply to finish before changing a message");
      return false;
    }
    try {
      await api.editSceneMessage({ messageId: id, swipeId, content, expectedVersion: scene.branchVersion });
      return true;
    } catch (e) {
      setStatus(stale(e) ? "the scene changed in another window; it has been reloaded" : `could not save the edit: ${toErrorMessage(e)}`);
      return false;
    } finally {
      load();
    }
  }, []);

  const put = useCallback(async (id: string, content: string | null, message: string): Promise<void> => {
    const h = viewRef.current;
    if (!h || h.id !== id || content === null) return;
    if (await apply(id, h.swipeId, content)) setToast({ message, id, swipeId: h.swipeId, redoText: h.current });
  }, [apply]);

  const undo = useCallback((id: string) => put(id, undoTarget(viewRef.current?.texts ?? []), "Edit undone"), [put]);
  const restore = useCallback((id: string, index: number) => put(id, viewRef.current?.texts[index] ?? null, "Earlier text restored"), [put]);
  const redo = useCallback(async (): Promise<void> => {
    const t = toast;
    setToast(null);
    if (t) await apply(t.id, t.swipeId, t.redoText);
  }, [toast, apply]);
  const dismiss = useCallback(() => setToast(null), []);

  const onUndoEdit = useCallback((id: string) => void undo(id), [undo]);
  const onRestore = useCallback((id: string, index: number) => void restore(id, index), [restore]);
  const onHistory = useCallback((id: string) => live.current.setMenu({ id, which: "history" }), []);
  /** The history props of the bubble for message `id`: only primitives and stable functions, so a finished bubble still skips re-rendering. */
  const bubble = (id: string, menu: "more" | "delete" | "history" | null) => ({
    onUndoEdit, onHistory, onRestore,
    historyCount: view?.id === id ? view.texts.length : undefined,
    history: menu === "history" && view?.id === id ? view : undefined,
  });

  return { read, redo, toast, dismiss, bubble };
}
