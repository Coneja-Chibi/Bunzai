/**
 * The chat summary's two jobs in a request (RoleCall `prompt-assembly.ts:684-735, 3274-3300`, rc-parity 08, Memory). It is text: `{{summary}}` and `{{chatsummary}}` expand to it, and the preset
 * seats it (presetPlan adds a "Chat Summary" block before the history when a preset names neither), so there is one way in. And it stands in for the messages it covers: with Hide messages
 * already covered on, those leave the prompt, newest `keep` always staying. RoleCall hides everything older than the newest `keep` whether or not the summary reaches it, which silently loses
 * the stretch between the summary and the kept messages; here a message goes only when the summary's `through` really covers it (a message with no place in the take is never hidden).
 * Pure: the same history and summary give the same cut.
 */
import type { HistoryMessage } from "./types";

/** How many of the oldest `history` messages the summary covers and may hide: a leading run of messages numbered below `through`, never more than leaves the newest `keep`. */
export function hideCovered(history: readonly HistoryMessage[], through: number, keep: number): number {
  const room = Math.max(0, history.length - Math.max(0, keep));
  let drop = 0;
  while (drop < room && history[drop]!.index !== undefined && history[drop]!.index! < through) drop++;
  return drop;
}
