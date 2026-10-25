/** One guarded older transcript page, including the scroll anchor that keeps the visible message fixed. */
import { useCallback, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import type { OpenScene, SceneMessagePage } from "../../../studio/scenes";

type SceneSetter = Dispatch<SetStateAction<OpenScene | null>>;
type PageInput = {
  api: AppContext["api"];
  chatId: string;
  scene: OpenScene | null;
  setScene: SceneSetter;
  generation: MutableRefObject<number>;
  scroller: RefObject<HTMLDivElement | null>;
  load(): void;
  setStatus(text: string): void;
};

export function useSceneOlderPage(input: PageInput) {
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const job = useRef(0);
  const anchor = useRef<{ top: number; height: number; branchId: string; nextBeforeSeq: number | null; firstId: string } | null>(null);
  const latest = useRef(input);
  latest.current = input;

  useLayoutEffect(() => {
    const saved = anchor.current;
    if (!saved) return;
    anchor.current = null;
    const scene = input.scene;
    if (!scene || scene.chat.activeBranchId !== saved.branchId || scene.beforeSeq !== saved.nextBeforeSeq || scene.messages[0]?.id !== saved.firstId) return;
    const el = input.scroller.current;
    if (el) el.scrollTop = saved.top + el.scrollHeight - saved.height;
  }, [input.scene, input.scroller]);

  // A reload, take switch, version change, or chat switch invalidates its pending request and clears
  // the spinner immediately; a stale request's finally cannot clear a newer job's state.
  useLayoutEffect(() => {
    const counter = job;
    counter.current++;
    inFlight.current = false;
    anchor.current = null;
    setLoading(false);
    return () => { counter.current++; };
  }, [input.chatId, input.scene?.chat.id, input.scene?.chat.activeBranchId, input.scene?.branchVersion]);

  /**
   * Loads the page before the oldest one shown. With `untilSeq` (a jump to a search hit) it keeps going back, a page at
   * a time, until the message at that sequence is in, then merges every page it read in one step, so a far hit costs
   * the pages between it and the loaded ones and never a read of the whole take. False when nothing was loaded.
   */
  const loadOlder = useCallback(async (untilSeq?: number): Promise<boolean> => {
    const state = latest.current;
    const scene = state.scene;
    if (!scene?.hasMore || scene.beforeSeq === null || inFlight.current) return false;
    inFlight.current = true;
    const id = ++job.current;
    const generation = state.generation.current;
    const chatId = state.chatId;
    const chatRecordId = scene.chat.id;
    const branchId = scene.chat.activeBranchId;
    const branchVersion = scene.branchVersion;
    const beforeSeq = scene.beforeSeq;
    setLoading(true);
    try {
      const pages: SceneMessagePage[] = [];
      for (let cursor = beforeSeq;;) {
        const page = await state.api.olderSceneMessages({ chatId, branchId, beforeSeq: cursor, expectedVersion: branchVersion });
        const current = latest.current.scene;
        if (id !== job.current || generation !== latest.current.generation.current || latest.current.chatId !== chatId ||
          !current || current.chat.id !== chatRecordId || current.chat.activeBranchId !== branchId || current.branchVersion !== branchVersion ||
          current.beforeSeq !== beforeSeq || page.branchId !== branchId || page.branchVersion !== branchVersion) return false;
        if (page.messages.length === 0) break;
        pages.unshift(page);
        if (untilSeq === undefined || page.beforeSeq === null || page.messages[0]!.seq <= untilSeq) break;
        cursor = page.beforeSeq;
      }
      const oldest = pages[0];
      const el = latest.current.scroller.current;
      if (!el || !oldest) return false;
      anchor.current = { top: el.scrollTop, height: el.scrollHeight, branchId, nextBeforeSeq: oldest.beforeSeq, firstId: oldest.messages[0]!.id };
      const older = pages.flatMap((page) => page.messages);
      latest.current.setScene((actual) => {
        if (!actual || actual.chat.id !== chatRecordId || actual.chat.activeBranchId !== branchId ||
          actual.branchVersion !== branchVersion || actual.beforeSeq !== beforeSeq) return actual;
        return {
          ...actual,
          messages: [...older, ...actual.messages],
          messageOffset: oldest.messageOffset,
          messageCount: oldest.messageCount,
          beforeSeq: oldest.beforeSeq,
          hasMore: oldest.hasMore,
          userMessageCount: oldest.userMessageCount,
          assistantMessageCount: oldest.assistantMessageCount,
          lastUserMessageIndex: oldest.lastUserMessageIndex,
          lastAssistantMessageIndex: oldest.lastAssistantMessageIndex,
        };
      });
      return true;
    } catch (error) {
      if (id === job.current && generation === latest.current.generation.current) {
        const stale = /\bversion\b|409/i.test(toErrorMessage(error));
        latest.current.setStatus(stale ? "the scene changed while older messages were loading; it has been reloaded" : `could not load older messages: ${toErrorMessage(error)}`);
        if (stale) latest.current.load();
      }
      return false;
    } finally {
      if (id === job.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);
  return { loadOlder, loadingOlder: loading };
}
