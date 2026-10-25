/**
 * Summary-aware context truncation (RoleCall `prompt-assembly.ts:3453-3470`, `tv_smart_context`): the oldest messages the Historian's
 * recaps already cover are left out of the request, the recaps standing in for them. RoleCall drops `2 * watermark` messages from the
 * front by a turn estimate and always keeps the newest 10; here a message goes only when a live recap's `turn_range` really covers its
 * live index, so a gap in the recaps stops the cut, and a message without an index never goes. Pure: the same history and recaps give
 * the same cut. The caller decides whether the setting is on by passing recaps at all.
 */
import type { HistoryMessage } from "./types";

/** One live recap of the Compendium: its text, and the live message indices `[from, to)` it covers. */
export interface SummaryRecap { entryKey: string; title: string; content: string; from: number; to: number }

/** RoleCall's floor (`MIN_KEEP`): the newest messages are never replaced. */
export const SUMMARY_KEEP = 10;

export const summaryText = (r: SummaryRecap): string => `[Summary: ${r.title}]\n${r.content}`;

const covers = (r: SummaryRecap, m: HistoryMessage): boolean => m.index !== undefined && r.from <= m.index && m.index < r.to;

/** How many of the oldest `history` messages recaps replace, and the recaps that cover any of them, oldest first. */
export function cutSummarized(history: readonly HistoryMessage[], all: readonly SummaryRecap[]): { drop: number; used: SummaryRecap[] } {
  // A blank recap would drop messages and put nothing in their place.
  const recaps = all.filter((r) => r.content.trim());
  const room = history.length - SUMMARY_KEEP;
  let drop = 0;
  while (drop < room && recaps.some((r) => covers(r, history[drop]!))) drop++;
  const gone = history.slice(0, drop);
  const used = recaps.filter((r) => gone.some((m) => covers(r, m))).sort((a, b) => a.from - b.from || a.to - b.to);
  return { drop, used };
}
