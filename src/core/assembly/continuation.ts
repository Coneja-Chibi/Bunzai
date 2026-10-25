/**
 * Continue, the pure half: what the assembler sends as the reply's
 * own assistant prefill, and what is appended to the reply once the model has spoken.
 */

/** RoleCall's cue for an assistant tail a model refuses (inference-engine.ts:5597); a non-blank preset Continue Nudge is sent in its place (AssemblyResult.continueNudge). */
export const CONTINUE_CUE = "Continue from the preceding assistant message.";

/**
 * The reply's text as the request carries it: trailing whitespace trimmed, since a final assistant
 * turn that ends in whitespace is refused by some providers. The stored reply keeps its own ending.
 */
export function continuationPrefill(text: string): string {
  return text.trimEnd();
}

/**
 * What to append to `original` out of what the model `streamed`. The model resumes after the prefill,
 * but some repeat what they were given (RoleCall cuts the repeat off); the reply's own trailing
 * whitespace is not doubled when the model sends it again. Empty means the model added nothing.
 * `separate` (a model that was shown the reply as a finished turn, so its text is a new paragraph)
 * puts a blank line between them unless one side already has whitespace there.
 */
export function continuationAddition(original: string, streamed: string, separate = false): string {
  const trimmed = continuationPrefill(original);
  const tail = original.slice(trimmed.length);
  let added = streamed;
  if (original && added.startsWith(original)) added = added.slice(original.length);
  else if (trimmed && added.startsWith(trimmed)) added = added.slice(trimmed.length);
  if (tail && added.startsWith(tail)) added = added.slice(tail.length);
  if (separate && added && original && !/\s$/.test(original) && !/^\s/.test(added)) return "\n\n" + added;
  return added;
}
