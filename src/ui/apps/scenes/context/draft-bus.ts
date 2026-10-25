/**
 * The composer's text, live, for the wing that forecasts it (RoleCall passes `currentMessage` down; here the composer owns its box and saves it to a pref only after a one-second pause,
 * which is too slow for "updates as you type"). The composer publishes every edit; the wing reads the latest, or the saved draft until the composer has published one.
 * A tiny external store: no draft text is kept beyond the page's life, and nothing is written anywhere.
 */
import { useSyncExternalStore } from "react";

const drafts = new Map<string, string>();
const listeners = new Set<() => void>();

/** The composer's text for a scene, as it stands now. */
export function publishDraft(chatId: string, text: string): void {
  if (drafts.get(chatId) === text) return;
  drafts.set(chatId, text);
  for (const notify of listeners) notify();
}

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

/** The latest published text for the scene, else what the caller has saved. */
export function useLiveDraft(chatId: string, saved: () => string): string {
  const live = useSyncExternalStore(subscribe, () => drafts.get(chatId), () => undefined);
  return live ?? saved();
}
