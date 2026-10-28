/**
 * Running a formula (entities/formula) where nothing may change: on a structuredClone of the macro context (its messages shared, as they are only read), so no variable, counter
 * or template it touches reaches the scene, and refused in words when it would have changed a variable, rather than letting the write
 * vanish. Macro handlers read only the context (ADR-012), so the copy is all a formula can touch. A blank formula or a macro error is
 * refused too, so a caller never shows a half-run result as the answer. A formula stops when the reply's tool time budget is spent (the tool loop hands in the clock), so a model calling
 * one round after round cannot tie up the server.
 */
import { processMacros, type MacroContext, type MacroDeadline } from "./macros";
import { withoutDeadline } from "./macros/deadline";

/** `deadline`: what is left of the reply's tool time budget (the tool loop's); the run stops with an error the model reads once it is spent. */
export function runFormulaReadOnly(text: string, context: MacroContext, seed: number, deadline?: MacroDeadline): { text: string } | { error: string } {
  if (!text.trim()) return { error: "This formula is empty." };
  let copy: MacroContext;
  try {
    // Everything a run can write is copied; the messages are only ever read, so the copy shares them (and the word index the chat-watch macros keep for that list).
    const { messages, ...writable } = withoutDeadline(context);
    copy = { ...structuredClone(writable), messages };
  } catch {
    return { error: "This formula could not run here." };
  }
  const done = processMacros(text, { ...copy, readOnly: false, randomSeed: seed, ...(deadline ? { deadline } : {}) });
  if (done.sideEffects.length > 0) {
    const names = [...new Set(done.sideEffects.map((fx) => fx.cause ?? fx.key))].join(", ");
    return { error: `This formula changes variables (${names}), which it cannot do here.` };
  }
  if (done.errors.length > 0) return { error: `This formula has a problem: ${done.errors[0]!.message}` };
  return { text: done.text };
}
