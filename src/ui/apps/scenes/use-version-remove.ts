/**
 * Remove one version of a reply, softly (ChatStore rule 32; approved wireframe rc-port/scene-version-remove.html).
 * More's "Remove version N of M" cuts the version the page shows through `cut-version` with no dialog, and an
 * Undo toast puts it back through `restore-version`. The version also waits in the Trash. The page reloads
 * either way, so a stale write shows the truth; nothing here keeps text.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "../../_shared/error-message";
import { FLASH_MS, useAutoDismiss } from "../../_shared/use-flash";
import type { ScenesApi } from "../../app-contract-scenes";
import type { OpenScene } from "../../../studio/scenes";
import { currentIndex, selectedSwipe, swipeCount } from "./use-scene-swipe-preview";

interface ToastState { message: string; id: string; swipeId: string }

const stale = (e: unknown): boolean => /\bversion\b|409/i.test(toErrorMessage(e));

export function useVersionRemove(o: {
  api: Pick<ScenesApi, "editScene">;
  scene: OpenScene | null;
  busy: boolean;
  load(): void;
  setStatus(text: string): void;
  setMenu(menu: null): void;
}) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const live = useRef(o);
  live.current = o;
  useEffect(() => { setToast((t) => (t ? null : t)); }, [o.scene?.chat.activeBranchId]);
  useAutoDismiss(toast, FLASH_MS.undo, () => setToast(null));

  const remove = useCallback((id: string): void => {
    const { api, scene, busy, load, setStatus, setMenu } = live.current;
    setMenu(null);
    const m = scene?.messages.find((x) => x.id === id);
    const swipe = m && selectedSwipe(m);
    if (!scene || !m || !swipe) return;
    if (busy) return setStatus("wait for the reply to finish before removing a version");
    const message = `Version ${currentIndex(m) + 1} of ${swipeCount(m)} removed.`;
    api.editScene("cut-version", { chatId: scene.chat.id, messageId: id, swipeId: swipe.id, expectedVersion: scene.branchVersion }).then(
      () => setToast({ message, id, swipeId: swipe.id }),
      (e: unknown) => setStatus(stale(e) ? "the scene changed in another window; it has been reloaded" : `could not remove the version: ${toErrorMessage(e)}`),
    ).finally(load);
  }, []);

  const undo = useCallback((): void => {
    const t = toast;
    setToast(null);
    if (!t) return;
    const { api, load, setStatus } = live.current;
    api.editScene("restore-version", { id: `${t.id}:${t.swipeId}` }).catch((e: unknown) => setStatus(`could not put the version back: ${toErrorMessage(e)}`)).finally(load);
  }, [toast]);

  return { remove, undo, toast };
}
