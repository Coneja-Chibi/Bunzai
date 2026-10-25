/**
 * The pure rules of in-scene search and Jump to latest, ported from RoleCall's ChatSearchOverlay.tsx (filters,
 * sort, wrap-around stepping) and auto-scroll-policy.ts (when the jump button shows). No React, no DOM.
 */
import type { SceneSearchHit } from "../../../studio/scene-search";
import { dayStamp, validMs } from "./scene-meta-core";

export type FindFilter = "all" | "character" | "user" | "thinking";
export type FindSort = "newest" | "oldest";
export const FIND_FILTERS: readonly FindFilter[] = ["all", "character", "user", "thinking"];

/** Which filter a hit belongs to: a match inside thinking is always "thinking", even from the character (ChatSearchOverlay.tsx:204-216, 302-314). */
export function kindOf(hit: Pick<SceneSearchHit, "role" | "thinking">): Exclude<FindFilter, "all"> | null {
  if (hit.thinking) return "thinking";
  if (hit.role === "assistant") return "character";
  if (hit.role === "user") return "user";
  return null;
}

export function filterCounts(hits: readonly SceneSearchHit[]): Record<FindFilter, number> {
  const counts: Record<FindFilter, number> = { all: hits.length, character: 0, user: 0, thinking: 0 };
  for (const hit of hits) {
    const kind = kindOf(hit);
    if (kind) counts[kind]++;
  }
  return counts;
}

/** The hits a filter keeps, by time (ChatSearchOverlay.tsx:199-231): newest first by default; messages with the same time keep the store's order. */
export function visibleHits(hits: readonly SceneSearchHit[], filter: FindFilter, sort: FindSort): SceneSearchHit[] {
  const kept = filter === "all" ? [...hits] : hits.filter((h) => kindOf(h) === filter);
  return kept.sort((a, b) => (sort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
}

/** One step through the results, wrapping at both ends (ArrowUp, ArrowDown, and the two buttons). */
export function stepResult(selected: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return 0;
  return delta === 1 ? (selected + 1) % count : selected <= 0 ? count - 1 : selected - 1;
}

/** RoleCall's FOLLOW_EPSILON_PX (auto-scroll-policy.ts:23): further than this from the bottom, the reader is scrolled back. */
export const AWAY_PX = 64;
/** RoleCall's reader counts as following a stream within this of the bottom; the scene page's own `following` rule (160px). */
export const FOLLOWING_PX = 160;

/** Jump to latest shows whenever the reader is away from the bottom (auto-scroll-policy.ts:67), except while a reply is streaming to a reader who is still following it (page.tsx:2188-2191). */
export function showJumpToLatest(distanceFromBottom: number, streaming: boolean): boolean {
  return distanceFromBottom > AWAY_PX && !(streaming && distanceFromBottom <= FOLLOWING_PX);
}

/**
 * A result's time as RoleCall words it (ChatSearchOverlay.tsx:330-345): the time today, "Yesterday", the weekday within
 * a week, else the date. Empty when the message has no time.
 */
export function findStamp(ms: number | undefined, now: Date): string {
  if (!validMs(ms)) return "";
  const date = new Date(ms);
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return dayStamp(ms);
}

/** RoleCall's script rendering of a result (parseScriptContent, ChatSearchOverlay.tsx:73-101): *(an action)* reads as an italic "(an action)". RoleCall's greedy pattern shows the closing bracket twice for that form; the lazy one here does not. */
export function scriptParts(text: string): Array<{ text: string; action: boolean }> {
  const parts: Array<{ text: string; action: boolean }> = [];
  const actions = /\*\(?([^*]+?)\)?\*/g;
  let last = 0;
  for (let m = actions.exec(text); m !== null; m = actions.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), action: false });
    parts.push({ text: `(${m[1]})`, action: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), action: false });
  return parts;
}
