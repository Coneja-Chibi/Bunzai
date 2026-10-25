/**
 * Retake from here (rc-message-features.md S11, RoleCall's F10 made explicit): fork the take at the user
 * message an earlier reply answers (the existing fork, ChatStore rule 6), then ask for a fresh reply on
 * the new take (the existing reply turn). No second branching path: the old take is untouched.
 */
import { useCallback, useMemo, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { retakePoints } from "./retake-core";
import type { Dialog, Row } from "./scene-page-types";
import type { useSceneTurn } from "./use-scene-turn";

interface Input {
  api: AppContext["api"];
  chatId: string;
  scene: OpenScene | null;
  rows: readonly Row[];
  connected: boolean;
  busy: boolean;
  turn: ReturnType<typeof useSceneTurn>;
  /** The page's one-change-at-a-time guard and its load counter, so a stale answer is dropped like any other change. */
  acting: MutableRefObject<boolean>;
  loadGeneration: MutableRefObject<number>;
  following: MutableRefObject<boolean>;
  setScene: Dispatch<SetStateAction<OpenScene | null>>;
  setDialog: Dispatch<SetStateAction<Dialog | null>>;
  closeMenus(): void;
  clearMacros(): void;
  clearSwipePreview(): void;
  setStatus(text: string): void;
  load(): void;
  isStale(e: unknown): boolean;
}

export function useSceneRetake(p: Input) {
  const retakeAt = useMemo(() => retakePoints(p.rows), [p.rows]);
  const retakeFrom = async (userId: string, name?: string): Promise<void> => {
    p.closeMenus();
    p.setDialog(null);
    if (!p.scene || p.acting.current || p.busy) return;
    p.acting.current = true;
    const generation = ++p.loadGeneration.current;
    p.clearMacros();
    try {
      const next = await p.api.editScene("fork", { chatId: p.chatId, messageId: userId, ...(name === undefined ? {} : { name }), expectedVersion: p.scene.branchVersion });
      if (generation !== p.loadGeneration.current) return;
      p.loadGeneration.current++;
      p.clearSwipePreview();
      p.following.current = true;
      p.setScene(next);
      void p.turn.start("reply", next.branchVersion, null, userId);
    } catch (e) {
      p.setStatus(p.isStale(e) ? "the scene changed in another window; it has been reloaded" : `could not retake: ${toErrorMessage(e)}`);
      p.load();
    } finally {
      p.acting.current = false;
    }
  };
  /** The menu item: Shift forks at once, otherwise the Fork dialog (told it is a retake) names the take first. */
  const retake = (replyId: string, skipDialog: boolean): void => {
    const from = p.connected && !p.busy ? retakeAt.get(replyId) : undefined;
    const m: Message | undefined = from && p.scene?.messages.find((x) => x.id === from.id);
    if (!from || !m) return;
    if (skipDialog) void retakeFrom(from.id);
    else {
      p.closeMenus();
      p.setDialog({ kind: "fork", m, n: from.n, retake: true });
    }
  };
  /** One function identity for every bubble: it calls whichever `retake` the latest render made. */
  const latest = useRef(retake);
  latest.current = retake;
  const dispatchRetake = useCallback((id: string, skipDialog: boolean) => latest.current(id, skipDialog), []);
  return { retakeAt, dispatchRetake, retakeFrom };
}
