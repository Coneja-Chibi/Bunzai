/** One selected transcript cell plus lazy swipe previews and the last-reply arrow keys. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import { isTypingTarget } from "../../_shared/typing-target";
import type { Message } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";

export const currentIndex = (m: Message): number => m.transcript?.currentIndex ?? m.current;
export const swipeCount = (m: Message): number => m.transcript?.swipeCount ?? m.swipes.length;
export const selectedSwipe = (m: Message) => m.transcript ? m.swipes[0] : m.swipes[m.current];
const stale = (error: unknown): boolean => /\bversion\b|409/i.test(toErrorMessage(error));

export function useSceneSwipePreview(input: {
  api: AppContext["api"];
  chatId: string;
  scene: OpenScene | null;
  generation: { current: number };
  busy: boolean;
  liveSwipe: { messageId: string } | null;
  lastReply: Message | null;
  wing: string | null;
  dialog: unknown;
  editing: unknown;
  select(message: Message, index: number): void;
  seen(): void;
  regenerate(): void;
  load(): void;
  setStatus(text: string): void;
}) {
  const [peek, setPeek] = useState<{ id: string; index: number } | null>(null);
  const [peekedSwipe, setPeekedSwipe] = useState<{ id: string; index: number; content: string; createdAt: number; generation?: Message["swipes"][number]["generation"] } | null>(null);
  const request = useRef(0);
  const latest = useRef(input);
  latest.current = input;
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    request.current++;
    setPeek(null);
    setPeekedSwipe(null);
  }, [input.scene?.chat.activeBranchId, input.scene?.branchVersion]);
  useEffect(() => {
    if (!input.busy) { setPeek(null); setPeekedSwipe(null); }
  }, [input.busy]);
  const browse = useCallback((m: Message, index: number) => {
    const state = latest.current;
    const active = state.liveSwipe?.messageId === m.id;
    const count = swipeCount(m) + (state.busy && active ? 1 : 0);
    if (index < 0 || index >= count) return;
    if (state.busy) {
      if (index === currentIndex(m)) { setPeek(null); setPeekedSwipe(null); return; }
      setPeek({ id: m.id, index });
      setPeekedSwipe(null);
      const id = ++request.current;
      const sceneGeneration = state.generation.current;
      if (active && index === swipeCount(m)) return;
      const scene = state.scene;
      if (!scene) return;
      void state.api.getSceneSwipe({ chatId: state.chatId, branchId: scene.chat.activeBranchId, messageId: m.id, index, expectedVersion: scene.branchVersion }).then((page) => {
        if (id === request.current && sceneGeneration === state.generation.current && page.branchId === scene.chat.activeBranchId && page.branchVersion === scene.branchVersion && page.swipe) {
          setPeekedSwipe({ id: m.id, index, content: page.swipe.content, createdAt: page.swipe.createdAt, generation: page.swipe.generation });
        }
      }, (error: unknown) => {
        if (id === request.current) {
          state.setStatus(stale(error) ? "the scene changed while its swipe was loading; it has been reloaded" : `could not load swipe: ${toErrorMessage(error)}`);
          if (stale(error)) state.load();
        }
      });
      return;
    }
    if (peek?.id === m.id && index === currentIndex(m)) {
      setPeek(null);
      setPeekedSwipe(null);
      state.seen();
      return;
    }
    setPeek(null);
    setPeekedSwipe(null);
    state.select(m, index);
  }, [peek]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const state = latest.current;
      const message = state.lastReply;
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || !message || state.wing || state.dialog || state.editing) return;
      if (isTypingTarget(e.target)) return;
      const count = swipeCount(message) + (state.liveSwipe?.messageId === message.id ? 1 : 0);
      const at = peek?.id === message.id ? peek.index : state.liveSwipe?.messageId === message.id ? count - 1 : currentIndex(message);
      e.preventDefault();
      if (e.key === "ArrowLeft" && at > 0) browse(message, at - 1);
      else if (e.key === "ArrowRight") at < count - 1 ? browse(message, at + 1) : state.regenerate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [browse, peek]);
  return { peek, peekedSwipe, browse, clear: () => { setPeek(null); setPeekedSwipe(null); } };
}
