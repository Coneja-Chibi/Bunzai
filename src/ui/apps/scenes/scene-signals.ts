/**
 * What the scene page knows about its own turns and swipes, held where the panels that draw scene state can read it (the page's `scene` is not handed down to a pop-out or a program's panel,
 * only the chat). `version` is the open take's branch version: a reply landing, a swipe, a regenerate and an edit of a message each move it, while the chat's `updatedAt` moves for none of
 * the swipe and regenerate cases. `running` is whether this window has a turn answering. The page publishes both (usePublishSceneSignals); a panel follows them (useSceneSignals) and reads
 * again when `version` moves. Per scene id, like the Story Director's live events (director-live.ts).
 */
import { useEffect, useSyncExternalStore } from "react";

export interface SceneSignals { version: number; running: boolean }
const NONE: SceneSignals = { version: 0, running: false };

const byChat = new Map<string, SceneSignals>();
const listeners = new Set<() => void>();

/** Records what the page knows; listeners hear only a change. */
export function publishSceneSignals(chatId: string, next: SceneSignals): void {
  const was = byChat.get(chatId) ?? NONE;
  if (was.version === next.version && was.running === next.running) return;
  byChat.set(chatId, next);
  for (const l of listeners) l();
}

export function useSceneSignals(chatId: string): SceneSignals {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => byChat.get(chatId) ?? NONE, () => NONE);
}

/** The page's side: publish the open take's version and whether a turn is answering, whenever either changes. */
export function usePublishSceneSignals(chatId: string, version: number | undefined, running: boolean): void {
  useEffect(() => { if (version !== undefined) publishSceneSignals(chatId, { version, running }); }, [chatId, version, running]);
}
