/**
 * The parity budgeter (turn-loop rule 6): RoleCall's history budget exactly as it runs, so recorded
 * fixtures match. Three passes, each ported from `prompt-assembly.ts` at the pin:
 *
 * 1. a loose pre-trim over the stored text (line 3264), a ceiling of the window less 2048;
 * 2. `ContextBudget.trimHistoryToFit` (`context-budget.ts`): characters over four, plus four per
 *    message, after reserving the character prompt, greeting, current message, and persona; history
 *    kept from the newest back until the next message would not fit, and at least the last four
 *    when nothing fits;
 * 3. `finalPassBudgetTrim` over the finished request, dropping the oldest user and assistant turns
 *    before the last user message.
 *
 * RoleCall's own comments record this estimate missing by 10 to 40 percent; the app budgeter
 * (budget-app.ts) is the one scenes use. This one exists to prove the port.
 */
import type { AssembledMessage, Budgeter } from "./types";

const estimate = (text: string): number => (text ? Math.ceil(text.length / 4) : 0);
const framed = (messages: readonly AssembledMessage[]): number => messages.reduce((sum, m) => sum + estimate(m.content) + 4, 0);

/** RoleCall's pre-trim: how many of the newest stored messages survive its loose ceiling. */
function preTrim(raw: readonly string[], context: number): number {
  if (raw.length <= 1) return raw.length;
  const ceiling = Math.max(Math.floor(context * 0.6), context - 2048);
  let total = 0;
  let cut = raw.length;
  for (let i = raw.length - 1; i >= 0; i--) {
    const tokens = Math.ceil((raw[i] ?? "").length / 4);
    if (total + tokens > ceiling && i < raw.length - 1) {
      cut = i + 1;
      break;
    }
    total += tokens;
    cut = i;
  }
  return raw.length - cut;
}

/** The fewest messages RoleCall keeps when the reservations alone overfill the window. */
const MIN_KEEP_MESSAGES = 4;

export const parityBudgeter: Budgeter = {
  name: "parity",
  fitHistory({ window, required, important, raw, history }) {
    const pre = history.slice(history.length - preTrim(raw, window.context));
    const reserved =
      required.reduce<number>((sum, r) => sum + (typeof r === "string" ? estimate(r) : framed(r)), 0) +
      important.reduce((sum, text) => sum + estimate(text), 0);
    const available = window.context - window.reply - reserved;
    if (available <= 0) return Math.min(pre.length, MIN_KEEP_MESSAGES);
    let used = 0;
    let kept = 0;
    for (let i = pre.length - 1; i >= 0; i--) {
      const tokens = estimate(pre[i]!.content) + 4;
      if (used + tokens > available) break;
      used += tokens;
      kept++;
    }
    return kept;
  },
  finalPass(messages, cap) {
    const keep = messages.map(() => true);
    let total = framed(messages);
    if (total <= cap) return { keep, dropped: 0 };
    const lastUser = messages.map((m) => m.role).lastIndexOf("user");
    let dropped = 0;
    for (let i = 0; i < messages.length && total > cap; i++) {
      const m = messages[i]!;
      if ((m.role === "user" || m.role === "assistant") && (lastUser === -1 || i < lastUser)) {
        total -= estimate(m.content) + 4;
        keep[i] = false;
        dropped++;
      }
    }
    return { keep, dropped };
  },
};
