/**
 * The Story Director's turn events, held where the panel and the floating button can both read them (the page forwards each `director` TurnEvent here, use-scene-turn.ts).
 * RoleCall keeps a session store the stream writes (stores/dm-activity.ts); Bunraku's lines live in the saved state, so this holds only what the state cannot: that the Director is
 * planning right now, why its last plan failed, a counter that tells the readers to read the state again, and a request to open the panel on a tab (the button's "View All Activity").
 */
import { useSyncExternalStore } from "react";
import type { TurnEvent } from "../../../../../studio/scene-turn";
import type { DirectorTabId } from "./director-core";

export interface DirectorLive { planning: boolean; failed: string | null; rev: number; tab: DirectorTabId | null }
const NONE: DirectorLive = { planning: false, failed: null, rev: 0, tab: null };

const byChat = new Map<string, DirectorLive>();
const listeners = new Set<() => void>();
const set = (chatId: string, next: Partial<DirectorLive>): void => {
  byChat.set(chatId, { ...(byChat.get(chatId) ?? NONE), ...next });
  for (const l of listeners) l();
};

export function publishDirector(chatId: string, e: Extract<TurnEvent, { type: "director" }>): void {
  const was = byChat.get(chatId) ?? NONE;
  if (e.status === "planning") set(chatId, { planning: true, failed: null });
  else set(chatId, { planning: false, failed: e.status === "failed" ? (e.reason ?? "The Director could not plan this reply.") : null, rev: was.rev + 1 });
}

/** The Director's state changed outside any turn (its background tracker round ended): the readers read it again. */
export const noteDirectorChanged = (chatId: string): void => set(chatId, { rev: (byChat.get(chatId) ?? NONE).rev + 1 });

/** Opens the panel on a tab: the reader that shows the panel takes the request once. */
export const requestDirectorTab = (chatId: string, tab: DirectorTabId): void => set(chatId, { tab });
export const takeDirectorTab = (chatId: string): DirectorTabId | null => {
  const was = byChat.get(chatId);
  if (!was?.tab) return null;
  byChat.set(chatId, { ...was, tab: null });
  return was.tab;
};

export function useDirectorLive(chatId: string): DirectorLive {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => byChat.get(chatId) ?? NONE, () => NONE);
}

/** "Change in Story Director": the Booth's line and a tracker's menu ask the page to open the Props wing at the Story Director's settings (the same window-event door the Stage and Storyboards use, use-stage-open.ts). */
export const DIRECTOR_SETTINGS_OPEN_EVENT = "bunraku:director-settings-open";
export const openDirectorSettings = (): void => { window.dispatchEvent(new Event(DIRECTOR_SETTINGS_OPEN_EVENT)); };
