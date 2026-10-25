/**
 * The canonical token-usage shape and its tolerant combinators: the inner-layer domain type the meter
 * and tally both read, plus the boundary reader that turns a provider's ragged usage numbers into a
 * clean TokenUsage. Lives in providers/ (not render/) so chat.ts and loop-core can produce usage
 * without importing upward into the render layer; the render meters import it inward. Pure: no I/O,
 * no clock, never throws. Tolerant-reader doctrine: undefined / NaN / Infinity / negative all read 0.
 */

/** One turn's (or one session's) token counts, every field a finite non-negative number. */
export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly total: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly reasoning: number;
}

/** The zero usage: the init value for the tally's turn/session and the fallback for a missing reply. */
export const EMPTY_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  total: 0,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
};

/** A count normalized to a finite, non-negative number (bad, zero, or negative input -> 0). */
export const cleanCount = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;

/** The raw, provider-shaped usage numbers, each optional (OAI-compat routers routinely omit them). */
export interface RawUsage {
  input?: number;
  output?: number;
  total?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
}

/** Parse ragged provider usage into a clean TokenUsage; total is derived from input+output if absent. */
export const readUsage = (raw: RawUsage): TokenUsage => {
  const input = cleanCount(raw.input);
  const output = cleanCount(raw.output);
  // Intentional || (not ??): a missing OR zero total is replaced by the derived sum, since 0 is never
  // a meaningful total when input+output is positive; a provider-reported positive total is kept.
  const total = cleanCount(raw.total) || input + output;
  return {
    input,
    output,
    total,
    cacheRead: cleanCount(raw.cacheRead),
    cacheWrite: cleanCount(raw.cacheWrite),
    reasoning: cleanCount(raw.reasoning),
  };
};

/** Field-wise sum of two usages; both inputs are left unmutated (the session accumulator's fold step). */
export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  total: a.total + b.total,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  reasoning: a.reasoning + b.reasoning,
});
