/**
 * Correct, wired (slice 7): the entry points for the "+" menu and the message menu, and the modal they open.
 * Apply edits the version being shown in place, as RoleCall's does (`chat.editMessage` on the current version,
 * useChatMessageHandlers.ts:2042-2113): no new version, and it goes through the scene's edit route, so Edit
 * history and Undo last edit catch it. `open(messageId, selection)` is the message menu's Correct (a passage the
 * person had highlighted opens the Rewrite tab on it); `openLast()` is the "+" menu's, which finds the last
 * reply and says "No AI message yet to correct." when there is none. Mount `modal` once on the page.
 */
import { useCallback, useRef, useState, type JSX } from "react";
import type { TextRange } from "../../../core/draft-prompts";
import type { OpenScene } from "../../../studio/scenes";
import type { ScenesApi } from "../../app-contract-scenes";
import { apiStatusIs } from "../../_shared/api-fetch";
import { CorrectionTools } from "./scene-correct";
import { selectedSwipe } from "./use-scene-swipe-preview";

interface Target { messageId: string; swipeId: string; text: string; selection: TextRange | null }

export function useSceneCorrect({ api, scene, reload, setStatus }: {
  api: Pick<ScenesApi, "runSceneDraft" | "listGuides" | "editSceneMessage">;
  scene: OpenScene | null;
  reload(): void;
  setStatus(text: string): void;
}): { open(messageId: string, selection?: TextRange | null): void; openLast(): void; modal: JSX.Element | null } {
  const [target, setTarget] = useState<Target | null>(null);
  const live = useRef({ scene, reload, setStatus });
  live.current = { scene, reload, setStatus };

  const open = useCallback((messageId: string, selection: TextRange | null = null): void => {
    const m = live.current.scene?.messages.find((x) => x.id === messageId);
    const swipe = m && selectedSwipe(m);
    if (!m || !swipe || !swipe.content.trim()) live.current.setStatus("There is no message text to correct.");
    else setTarget({ messageId, swipeId: swipe.id, text: swipe.content, selection });
  }, []);

  const openLast = useCallback((): void => {
    const last = live.current.scene?.messages.findLast((m) => m.role === "assistant" && !m.cut);
    if (last) open(last.id);
    else live.current.setStatus("No AI message yet to correct.");
  }, [open]);

  const apply = async (text: string): Promise<void> => {
    const { scene: now, reload: refresh } = live.current;
    if (!target || !now) return;
    try {
      await api.editSceneMessage({ messageId: target.messageId, swipeId: target.swipeId, content: text, expectedVersion: now.branchVersion });
    } catch (e) {
      if (apiStatusIs(e, 409)) {
        refresh();
        throw new Error("The scene changed in another window; it has been reloaded. Open Correct again.");
      }
      throw e;
    }
    refresh();
  };

  const modal = target && scene ? <CorrectionTools api={api} chatId={scene.chat.id} message={target.text} selection={target.selection} onApply={apply} onClose={() => setTarget(null)} /> : null;
  return { open, openLast, modal };
}
