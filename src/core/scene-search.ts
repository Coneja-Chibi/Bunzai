/**
 * The pure half of in-scene search, ported from RoleCall's useChatSearch.ts (words of 2+ characters that must all
 * be present, a 50-character context) and ChatSearchOverlay.tsx (thinking detection, the mark in a result). Shared
 * by the studio (which builds each hit's context) and the page (which marks it). No DOM, no store.
 */

import { MAX_SEARCH_WORDS, MAX_WORD, MIN_WORD } from "./search/contracts";
import { reasoningSpanAt, type ReasoningFormat } from "./reasoning-tags";

const CONTEXT = 50;

/** The query's words: lower case, 2 or more characters, capped at the store's longest word, each once, at most eight (RoleCall's `queryWords`, useChatSearch.ts:18). */
export function searchTerms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= MIN_WORD).map((w) => w.slice(0, MAX_WORD));
  return [...new Set(words)].slice(0, MAX_SEARCH_WORDS);
}

/**
 * RoleCall's snippet (useChatSearch.ts:27-41): fifty characters either side of the first word, "..." where it was
 * cut. RoleCall measures the span by the query's length; the words joined by a space are that length.
 */
export function contextAround(content: string, words: readonly string[]): { context: string; at: number } {
  const first = words[0];
  const at = first === undefined ? -1 : content.toLowerCase().indexOf(first);
  const start = Math.max(0, at);
  const from = Math.max(0, start - CONTEXT);
  const to = Math.min(content.length, start + words.join(" ").length + CONTEXT);
  return { context: (from > 0 ? "..." : "") + content.slice(from, to) + (to < content.length ? "..." : ""), at };
}

/** True when the position falls inside a reasoning block: the built-in tags, or the preset's own markers (ChatSearchOverlay.tsx:56-67). */
export function isThinkingAt(content: string, position: number, format?: ReasoningFormat): boolean {
  return reasoningSpanAt(content, position, format) !== null;
}

/**
 * The text split into plain and marked parts, marking every occurrence of every word. RoleCall marks only the
 * whole query as one string (ChatSearchOverlay.tsx:347-357), so a query of words that are not next to each other
 * marks nothing; marking each word is the fix.
 */
export function markSegments(text: string, words: readonly string[]): Array<{ text: string; hit: boolean }> {
  if (text === "") return [];
  const lower = text.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const word of words) {
    if (word === "") continue;
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) spans.push([at, at + word.length]);
  }
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [from, to] of spans) {
    if (to <= cursor) continue;
    const start = Math.max(from, cursor);
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, to), hit: true });
    cursor = to;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
