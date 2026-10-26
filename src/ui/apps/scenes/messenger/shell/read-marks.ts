/**
 * Unread tracking for the Messenger (backlog slice 1, decision D9): a studio pref `messenger.readMarks` holding `{ [chatId]: { at, count } }`, the message count of the active take the
 * last time the person had the scene open and in view. Unread is `messageCount - mark.count` (never negative). A scene with no mark has never been opened here, so it is not flagged: a fresh
 * library does not light up every row. The map is parsed once at this boundary (bad entries are dropped) and kept to the newest MAX_MARKS scenes. A mark is only written when it changes,
 * so a message count that has not moved never touches the settings file.
 */
import { isRecord } from "../../../../../core/guards";
import type { AppContext } from "../../../../app-contract";
import type { SceneSummary } from "../../../../../studio/scenes";

export const READ_MARKS_KEY = "messenger.readMarks";
export const MAX_MARKS = 500;

export interface ReadMark { at: number; count: number }
export type ReadMarks = Readonly<Record<string, ReadMark>>;

type Prefs = AppContext["prefs"];

const isMark = (v: unknown): v is ReadMark =>
  typeof v === "object" && v !== null && Number.isFinite((v as ReadMark).at) && Number.isInteger((v as ReadMark).count) && (v as ReadMark).count >= 0;

export function readMarks(prefs: Prefs): ReadMarks {
  const raw = prefs.get(READ_MARKS_KEY);
  if (!isRecord(raw)) return {};
  const out: Record<string, ReadMark> = {};
  for (const [id, mark] of Object.entries(raw)) if (isMark(mark)) out[id] = { at: mark.at, count: mark.count };
  return out;
}

/** Messages this scene has gained since it was last read; 0 for a scene without a mark. */
export const unreadOf = (marks: ReadMarks, chatId: string, messageCount: number): number => {
  const mark = marks[chatId];
  return mark ? Math.max(0, messageCount - mark.count) : 0;
};

/** Marks the scene read up to `count`. Returns the marks now saved, or the same `marks` object when nothing changed (no write). */
export function markRead(prefs: Prefs, marks: ReadMarks, chatId: string, count: number, now: number): ReadMarks {
  if (marks[chatId]?.count === count) return marks;
  const next: Record<string, ReadMark> = { ...marks, [chatId]: { at: now, count } };
  const ids = Object.keys(next);
  if (ids.length > MAX_MARKS) for (const id of ids.sort((a, b) => next[a]!.at - next[b]!.at).slice(0, ids.length - MAX_MARKS)) delete next[id];
  prefs.set(READ_MARKS_KEY, next);
  return next;
}

/** Unread per scene id for the scenes that have any. The open scene is read by definition (its listed count is older than the page's own), so it is left out. */
export function unreadByScene(marks: ReadMarks, scenes: readonly SceneSummary[], openId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of scenes) {
    const n = s.id === openId ? 0 : unreadOf(marks, s.id, s.messageCount);
    if (n > 0) out[s.id] = n;
  }
  return out;
}

/** Unread per character id: the sum over all of that character's scenes. */
export function unreadByCharacter(perScene: Readonly<Record<string, number>>, scenes: readonly SceneSummary[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of scenes) {
    const n = perScene[s.id];
    if (n) out[s.cast.character.id] = (out[s.cast.character.id] ?? 0) + n;
  }
  return out;
}

/** "99+" past two digits so the badge stays a badge. */
export const unreadLabel = (n: number): string => (n > 99 ? "99+" : String(n));
