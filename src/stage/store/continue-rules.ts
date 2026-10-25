/** The store's rule for what a continue leaves on a swipe's generation record (ChatStore rule 31). */
import type { Generation } from "../contracts/chat-store";

/**
 * The generation record of a swipe after a continue (rule 31): the continuation's finish reason
 * replaces the old one (absent when it has none), completion tokens and time add up when both sides
 * have them, and the rest (model, preset, samplers, reasoning) stays with the first part.
 */
export function continuedGeneration(before: Generation | undefined, added: Generation | undefined): Generation | undefined {
  if (!before) return added;
  const { finishReason: _old, ...kept } = before;
  const sum = (a: number | undefined, b: number | undefined) => (a !== undefined && b !== undefined ? a + b : a);
  return {
    ...kept,
    ...(added?.finishReason === undefined ? {} : { finishReason: added.finishReason }),
    ...(before.completionTokens === undefined ? {} : { completionTokens: sum(before.completionTokens, added?.completionTokens)! }),
    ...(before.generationMs === undefined ? {} : { generationMs: sum(before.generationMs, added?.generationMs)! }),
  };
}
