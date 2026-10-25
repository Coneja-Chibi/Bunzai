/**
 * Final Cut's activity on a reply, wired: the scissors button on a bubble opens the dialog for that reply. Apply and Undo edit the
 * shown version in place through the scene's edit route (as Correct does, use-scene-correct.tsx), so Edit history and Undo last edit
 * catch them; a stale take reloads and says so. Mount `modal` once on the page.
 */
import { useCallback, useRef, useState, type JSX } from "react";
import { activePasses } from "../../../core/final-cut/pass";
import type { OpenScene } from "../../../studio/scenes";
import type { ScenesApi } from "../../app-contract-scenes";
import { apiStatusIs } from "../../_shared/api-fetch";
import { FinalCutActivity } from "./final-cut/fc-activity";
import { selectedSwipe } from "./use-scene-swipe-preview";

export function useSceneFinalCut({ api, scene, reload }: {
  api: Pick<ScenesApi, "getFinalCutRun" | "rerunFinalCut" | "applyFinalCutRerun" | "editSceneMessage">;
  scene: OpenScene | null;
  reload(): void;
}): { open(messageId: string): void; modal: JSX.Element | null } {
  const [messageId, setMessageId] = useState<string | null>(null);
  const live = useRef({ scene, reload });
  live.current = { scene, reload };
  const open = useCallback((id: string): void => setMessageId(id), []);
  const apply = async (text: string): Promise<void> => {
    const { scene: now, reload: refresh } = live.current;
    const m = now?.messages.find((x) => x.id === messageId);
    const swipe = m && selectedSwipe(m);
    if (!now || !m || !swipe) throw new Error("That reply is gone.");
    try {
      await api.editSceneMessage({ messageId: m.id, swipeId: swipe.id, content: text, expectedVersion: now.branchVersion });
    } catch (e) {
      if (apiStatusIs(e, 409)) {
        refresh();
        throw new Error("The scene changed in another window; it has been reloaded. Open Final Cut Activity again.");
      }
      throw e;
    }
    refresh();
  };
  const applyRerun = async (rerunId: string): Promise<void> => {
    const { scene: now, reload: refresh } = live.current;
    if (!now) throw new Error("That reply is gone.");
    try {
      await api.applyFinalCutRerun(now.chat.id, rerunId, now.branchVersion);
    } catch (e) {
      if (apiStatusIs(e, 409)) {
        refresh();
        throw e;
      }
      throw e;
    }
    refresh();
  };
  const modal = messageId && scene
    ? <FinalCutActivity api={api} chatId={scene.chat.id} messageId={messageId} enabled={activePasses(scene.chat.finalCut?.passes).length} onApply={apply} onApplyRerun={applyRerun} onClose={() => setMessageId(null)} />
    : null;
  return { open, modal };
}
