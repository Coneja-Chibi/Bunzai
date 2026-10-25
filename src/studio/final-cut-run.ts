/**
 * The Final Cut pipeline (RoleCall lib/post-gen-actions/service.ts:113-227): the scene's passes in order, each handed the text the one
 * before left, under one ten-minute budget for the whole run. A pass that fails follows its own failure mode: Save original reply and
 * Skip failed pass both carry on with the text as it was; Block generation ends the run with FinalCutBlocked, and the turn then keeps
 * nothing and hands the reply back as a draft. A Stop or the budget ends the run where it stands: the text the passes so far accepted
 * is kept and the rest are not run. Pure of storage; the turn decides what the text becomes.
 */
import type { FinalCutPass } from "../core/final-cut/pass";
import { PassFailure, classify } from "./final-cut-errors";
import { runPass, type PassEnv, type PassResult } from "./final-cut-pass";

export const BUDGET_MS = 600_000;

export interface FinalCutRun {
  original: string;
  final: string;
  passes: PassResult[];
  changed: boolean;
  /** Why the run ended early, when it did. */
  stopped?: "cancelled" | "timed_out";
  at: number;
  ms: number;
}

/** A pass set to Block generation failed. */
export class FinalCutBlocked extends Error {
  constructor(message: string, readonly pass: string) {
    super(message);
    this.name = "FinalCutBlocked";
  }
}

export async function runFinalCut(input: { text: string; passes: readonly FinalCutPass[]; env: Omit<PassEnv, "signal">; signal: AbortSignal; budgetMs?: number; /** Called as each pass starts. */ progress?(pass: FinalCutPass, index: number): void }): Promise<FinalCutRun> {
  const { env } = input;
  const at = env.now();
  const budget = new AbortController();
  const timer = setTimeout(() => budget.abort(new PassFailure("timed_out")), input.budgetMs ?? BUDGET_MS);
  const stop = (): void => budget.abort(input.signal.reason);
  input.signal.addEventListener("abort", stop, { once: true });
  if (input.signal.aborted) stop();
  const results: PassResult[] = [];
  let current = input.text;
  let stopped: FinalCutRun["stopped"];
  try {
    for (const [index, pass] of input.passes.entries()) {
      if (budget.signal.aborted) { stopped = classify(budget.signal.reason) === "timed_out" ? "timed_out" : "cancelled"; break; }
      input.progress?.(pass, index);
      const result = await runPass(pass, current, { ...env, signal: budget.signal });
      results.push(result);
      if (result.status === "failed") {
        const klass = budget.signal.aborted ? classify(budget.signal.reason) : null;
        if (klass === "timed_out" || klass === "cancelled") { stopped = klass; break; }
        if (pass.failureMode === "block") throw new FinalCutBlocked(result.warnings[0] ?? "A pass failed.", pass.label ?? pass.type);
      }
      if (result.status === "applied") current = result.output;
    }
  } finally {
    clearTimeout(timer);
    input.signal.removeEventListener("abort", stop);
  }
  return { original: input.text, final: current, passes: results, changed: current !== input.text, ...(stopped ? { stopped } : {}), at, ms: env.now() - at };
}
