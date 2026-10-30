/**
 * The conversation a Dramaturg turn sends before its question (specs/stage/dramaturg.md, "A turn" step 4): the last 40 turns, 60,000 characters
 * at most, the newest kept, and never opening on an answer. An answer that did not finish says so, so the model never reads a cut-off
 * reading as a complete one. When the model states its window and the prompt outgrows it, `fitHistory` lets the conversation go, oldest
 * first, before anything of the evidence does.
 */
import type { ProviderMessage } from "../../stage/contracts/provider";
import type { DramaturgEntry } from "../../stage/contracts/dramaturg-types";

const TURNS = 40;
const CHARS = 60_000;

export function dramaturgHistory(entries: readonly DramaturgEntry[]): ProviderMessage[] {
  const out: ProviderMessage[] = [];
  let used = 0;
  for (const e of entries.slice(-TURNS).reverse()) {
    const content = e.failed ? `${e.text}\n\n[This answer did not finish: ${e.failed}]` : e.text;
    if (used + content.length > CHARS) break;
    used += content.length;
    out.unshift({ role: e.role, content });
  }
  if (out[0]?.role === "assistant") out.shift();
  return out;
}

/** The history that fits `budget` beside the `fixed` part (the system message and the question), oldest question and answer first; all of it when it fits. */
export function fitHistory(history: readonly ProviderMessage[], fixed: number, budget: number, count: (text: string) => number): ProviderMessage[] {
  const out = [...history];
  let total = fixed + out.reduce((n, m) => n + count(m.content), 0);
  while (out.length > 0 && total > budget) {
    total -= count(out.shift()!.content);
    if (out[0]?.role === "assistant") total -= count(out.shift()!.content);
  }
  return out;
}
