/**
 * The app budgeter (turn-loop rule 6, token-meter rules 2 and 8): the budget scenes use. Where the
 * parity budgeter guesses characters over four, this budgets with the token meter's safe upper
 * bound for the scene's model, and trims history in chunks so the start of the prompt, and with it
 * the provider's cached prefix, stays put for several turns.
 *
 * The real trim still happens once, over the finished request (`finalPass`), so it measures what is
 * really sent rather than RoleCall's stand-ins for it. `fitHistory` runs first and only ever narrows
 * what reaches that point, and it is exact by construction, not
 * an estimate: it sums the *same* `measure.part` finalPass would use, for the *same* content finalPass
 * would see (assemble.ts's `contentFromNewest`: a message's own text, unchanged, unless it contains a
 * macro, in which case its macro-expanded form - a message with no `{{` cannot be changed by the macro
 * pass at all, so measuring its own text already is measuring the real final content, not a proxy for
 * it). It walks from the newest message backward, in the same chunk-aligned steps `trimHistory` itself
 * uses, and stops the instant the running total provably exceeds the budget: from that point on, every
 * older message is one `finalPass`'s own exact trim would also have dropped (the sum can only grow as
 * more history is added, never shrink), so nothing this cuts is ever something `finalPass` would have
 * kept. Because every number here already *is* the real cost, no separate bound or margin is needed,
 * and no assumption about any tokenizer's characters-per-token is made anywhere in this file.
 * `contentFromNewest` is memoized by assemble.ts's own macro cache, so a message this walk inspects and
 * keeps is never macro-expanded or measured twice. The turn loop supplies the measure from the meter
 * (src/core/tokens), so this file stays pure.
 */
import { trimHistory } from "../tokens";
import type { Budgeter } from "./types";

/** Upper-bound token counts from the meter for the scene's model. */
export interface Measure {
  /** A whole prompt of these message texts, framing and the model's fixed overhead included. */
  whole(texts: readonly string[]): number;
  /** One message inside a prompt: its text and framing, no fixed overhead. */
  part(text: string): number;
}

/** History dropped per step when nothing else is set: the prefix holds for about four exchanges. */
export const DEFAULT_CHUNK = 8;

export function appBudgeter(measure: Measure, chunk = DEFAULT_CHUNK): Budgeter {
  return {
    name: "app",
    /**
     * An exact pre-trim (P2): how many of the newest `raw` messages to keep before any per-message
     * macro or real token-count work runs on them. `required`/`important` are already fully formed,
     * fixed-size text by the time this is called (the character prompt, the greeting, the persona,
     * depth notes, lore's reserved share) - never scaling with history - so measuring them for real
     * here costs nothing extra and gives an exact reservation, not an estimate.
     *
     * Grows `keep` from the newest message outward in `chunk`-sized steps, on the same grid
     * `trimHistory` itself steps on (counted from the true oldest message, per `minKeep`'s own
     * docblock), summing `measure.part(contentFromNewest(i))` for each newly-added message - the real
     * cost, not a bound on it. The moment that running sum exceeds the real, exact `available` budget,
     * every message older than the current `keep` is provably one `finalPass`'s own exact trim would
     * also have cut (the sum only grows as more of the oldest history is added back in), so this
     * returns immediately rather than summing the rest of a possibly enormous scene. `minKeep` floors
     * the search so a depth note, an in-chat block or an append block still finds the same history
     * `buildConversation` would have given it. If nothing ever proves an overflow, every message gets
     * summed once (unavoidable: they all survive into the prompt regardless) and this returns `n`,
     * leaving `finalPass` to do what it always has.
     */
    fitHistory({ window, required, important, raw, minKeep, contentFromNewest }) {
      const n = raw.length;
      if (n === 0) return 0;
      const get = contentFromNewest ?? ((i: number) => raw[n - 1 - i]!);
      const floor = Math.max(0, Math.min(n, Math.floor(minKeep ?? 0)));
      const reserved =
        required.reduce<number>((sum, r) => sum + (typeof r === "string" ? measure.part(r) : r.reduce((s, m) => s + measure.part(m.content), 0)), 0) +
        important.reduce((sum, text) => sum + measure.part(text), 0);
      const available = window.context - window.reply - reserved;
      let processed = 0;
      let sum = 0;
      const sumUpTo = (target: number) => {
        for (; processed < target; processed++) sum += measure.part(get(processed));
      };
      for (let keep = n % chunk; keep < n; keep += chunk) {
        sumUpTo(keep);
        if (keep >= floor && sum > available) return keep;
      }
      return n;
    },
    finalPass(messages, cap, history) {
      const at = messages.flatMap((_, i) => (history[i] ? [i] : []));
      const { drop, overflow } = trimHistory({
        fixed: measure.whole(messages.filter((_, i) => !history[i]).map((m) => m.content)),
        history: at.map((i) => measure.part(messages[i]!.content)),
        window: cap,
        reserve: 0,
        chunk,
        protectTail: 0,
      });
      const keep = messages.map(() => true);
      for (const i of at.slice(0, drop)) keep[i] = false;
      return { keep, dropped: drop, overflow };
    },
  };
}
