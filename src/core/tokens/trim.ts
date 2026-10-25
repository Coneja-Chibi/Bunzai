/**
 * Cache-friendly history trimming: the app
 * budgeter's half of the budget seam.
 *
 * RoleCall drops the oldest message the moment history does not fit. As a chat grows, that moves the
 * start of the prompt on every send, so the provider never finds the same prefix twice and the cache
 * never hits. This trims in steps of `chunk` messages, counted from the start of the history, so the
 * first kept message stays put for several turns and the cached prefix survives until the next step.
 *
 * It budgets with the meter's upper bound (rule 2), never the midpoint. Pure.
 */

export interface TrimInput {
  /** Every prompt token that is not history (system, card, persona, injections), as an upper bound. */
  fixed: number;
  /** Each history message's upper-bound tokens, oldest first. */
  history: readonly number[];
  /** The model's context window. */
  window: number;
  /** Tokens held back for the reply. */
  reserve: number;
  /** Messages dropped per step; 1 behaves like RoleCall. */
  chunk: number;
  /** The newest `protectTail` messages are never dropped (the message being answered). */
  protectTail?: number;
}

export interface TrimResult {
  /** How many of the oldest history messages to leave out. */
  drop: number;
  /** The upper-bound total of what is kept, history and fixed together. */
  used: number;
  /** True when even the protected tail and the fixed part do not fit: the caller must say so, not send. */
  overflow: boolean;
}

export function trimHistory(input: TrimInput): TrimResult {
  const { fixed, history, window, reserve } = input;
  const chunk = Math.max(1, Math.floor(input.chunk));
  const protect = Math.min(history.length, Math.max(0, input.protectTail ?? 1));
  const budget = window - reserve - fixed;
  const suffix = new Array<number>(history.length + 1).fill(0);
  for (let i = history.length - 1; i >= 0; i--) suffix[i] = (suffix[i + 1] ?? 0) + (history[i] ?? 0);
  const keptFrom = (drop: number) => suffix[drop] ?? 0;
  const maxDrop = history.length - protect;
  for (let drop = 0; drop <= maxDrop; drop = drop === maxDrop ? maxDrop + 1 : Math.min(drop + chunk, maxDrop)) {
    if (keptFrom(drop) <= budget) return { drop, used: fixed + keptFrom(drop), overflow: false };
  }
  return { drop: maxDrop, used: fixed + keptFrom(maxDrop), overflow: true };
}
