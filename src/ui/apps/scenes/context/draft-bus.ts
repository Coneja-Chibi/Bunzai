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

/** What the draft looks like after `piece` goes in at the selection: a space is added on a side that would glue words together. Never replaces text unless it is selected. */
export function insertAtCaret(draft: string, piece: string, start: number, end: number): { text: string; caret: number } {
  const from = Math.min(Math.max(start, 0), draft.length);
  const to = Math.min(Math.max(end, from), draft.length);
  const before = draft.slice(0, from);
  const after = draft.slice(to);
  const lead = before !== "" && !/\s$/.test(before) ? " " : "";
  const tail = after !== "" && !/^\s/.test(after) ? " " : "";
  const text = `${before}${lead}${piece}${tail}${after}`;
  return { text, caret: before.length + lead.length + piece.length + tail.length };
}

type Inserter = (piece: string) => boolean;
const inserters = new Map<string, Inserter>();

const pending = new Map<string, string[]>();

/** The composer of a scene takes inserts while mounted; the returned function stops it. Pieces queued while no composer was open go in now, in order. */
export function registerInserter(chatId: string, take: Inserter): () => void {
  inserters.set(chatId, take);
  const waiting = pending.get(chatId);
  if (waiting) {
    pending.delete(chatId);
    const kept = waiting.filter((piece) => !take(piece));
    if (kept.length > 0) pending.set(chatId, kept);
  }
  return () => { if (inserters.get(chatId) === take) inserters.delete(chatId); };
}

/** Asks the scene's composer to put `piece` in its draft (Ping, a suggested action). Returns false when no composer took it; nothing is ever sent. */
export function insertIntoDraft(chatId: string, piece: string): boolean {
  return inserters.get(chatId)?.(piece) ?? false;
}

/** Holds `piece` for the scene's next composer (it goes in the draft when one opens); nothing is sent. */
export function queueForDraft(chatId: string, piece: string): void {
  pending.set(chatId, [...(pending.get(chatId) ?? []), piece]);
}
