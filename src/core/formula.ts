/**
 * Running a formula (entities/formula) where nothing may change: on a structuredClone of the macro context, so no variable, counter
 * or template it touches reaches the scene, and refused in words when it would have changed a variable, rather than letting the write
 * vanish. Macro handlers read only the context (ADR-012), so the copy is all a formula can touch. A blank formula or a macro error is
 * refused too, so a caller never shows a half-run result as the answer. A formula runs on its own small step budget, so a model calling
 * one round after round cannot tie up the server.
 */
import { processMacros, type MacroContext } from "./macros";

/** A formula's evaluation steps: plenty for real formulas, and a model calling one again and again stays fast (formula.test.ts measures it). */
export const FORMULA_STEPS = 1_000;

export function runFormulaReadOnly(text: string, context: MacroContext, seed: number): { text: string } | { error: string } {
  if (!text.trim()) return { error: "This formula is empty." };
  let copy: MacroContext;
  try {
    copy = structuredClone(context);
  } catch {
    return { error: "This formula could not run here." };
  }
  const done = processMacros(text, { ...copy, readOnly: false, randomSeed: seed, maxSteps: FORMULA_STEPS });
  if (done.sideEffects.length > 0) {
    const names = [...new Set(done.sideEffects.map((fx) => fx.cause ?? fx.key))].join(", ");
    return { error: `This formula changes variables (${names}), which it cannot do here.` };
  }
  if (done.errors.length > 0) return { error: `This formula has a problem: ${done.errors[0]!.message}` };
  return { text: done.text };
}
