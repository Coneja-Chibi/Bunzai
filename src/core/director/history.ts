/**
 * The conversation the planner reads (RoleCall `dm-stream/director-history.ts`): the newest 30 messages inside a 24,000-character budget, each labeled by its turn, the oldest one that
 * does not fit clipped from its middle, and a note of how many earlier messages were left out. The caller has already taken the old thinking out of the assistant's replies.
 */
export interface HistoryLine { role: string; content: string }

export const HISTORY_CHAR_BUDGET = 24_000;
const MAX_RECENT = 30;
const NOTICE_RESERVE = 128;

export function formatDirectorHistory(history: readonly HistoryLine[]): string {
  const sections: string[] = [];
  let remaining = HISTORY_CHAR_BUDGET - NOTICE_RESERVE;
  let firstIncluded = history.length;
  const earliest = Math.max(0, history.length - MAX_RECENT);
  for (let index = history.length - 1; index >= earliest; index -= 1) {
    const message = history[index]!;
    const label = `[Turn ${index + 1}] ${message.role}: `;
    const budget = remaining - label.length - 2;
    if (budget < 256) break;
    let content = message.content;
    const clipped = content.length > budget;
    if (clipped) {
      // The omission is part of the prompt, so its note is reserved before the text is split between its opening and its end.
      const reserve = `\n[${content.length} characters omitted from the middle of this message]\n`.length;
      const retained = Math.max(0, budget - reserve);
      const head = Math.ceil(retained / 2);
      const tail = Math.floor(retained / 2);
      content = `${content.slice(0, head)}\n[${content.length - retained} characters omitted from the middle of this message]\n${tail ? content.slice(-tail) : ""}`;
    }
    sections.unshift(label + content);
    remaining -= label.length + content.length + 2;
    firstIncluded = index;
    if (clipped) break;
  }
  if (firstIncluded > 0) sections.unshift(`[${firstIncluded} earlier messages omitted from Director history due to the recent-history budget]`);
  return sections.join("\n\n");
}
