/**
 * Guided re-roll's request text (rc-parity 03 slice 5), a port of RoleCall's lib/ai/guided-swipe.ts
 * buildGuidedSwipeDirective and appendGuidedSwipeDirective (the attempt-record machinery is not ported:
 * the guidance rides on the new version's generation record). The rejected draft goes in as an assistant
 * message so prose that imitates a directive never gains system authority; a clean system directive
 * follows it. The prefill, when the model takes one, is added after both (request.ts withPrefill).
 */
import { countText } from "../tokens";
import type { AssembledMessage, TraceBlock } from "./types";

/** The longest guidance a turn takes: the Scene Note's own limit (note.ts NOTE_MAX). */
export const GUIDANCE_MAX = 10_000;

/** Marks the rejected draft inside its own content, not just by its role (RoleCall: REJECTED_DRAFT_LABEL). */
export const REJECTED_DRAFT_LABEL = "[REJECTED DRAFT - NOT PART OF THE STORY]";

/** The one-shot instruction, word for word as RoleCall words it; the rejected prose is not in it. */
export function buildGuidedSwipeDirective(guidance: string): string {
  return [
    "<<<MANDATORY GUIDED SWIPE DIRECTIVE>>>",
    "REWIND. The assistant message directly above is a rejected draft. It was",
    "never sent. The character never said or did any of it. The scene has NOT",
    "moved past the user's last message.",
    "",
    "Write the character's reply to that user message again, starting from the",
    "same story moment the draft started from. Your text replaces the draft",
    "entirely.",
    "",
    "USER DIRECTION:",
    guidance.trim(),
    "",
    "Read the draft only to see what to avoid, then write as if it never",
    "existed. Do not continue it, extend it, or refer to it.",
    "<<<END GUIDED SWIPE DIRECTIVE>>>",
  ].join("\n");
}

/** The request with the rejected draft and the directive on its end; blank guidance is a plain re-roll and changes nothing. */
export function appendGuidedSwipe(messages: readonly AssembledMessage[], rejected: string, guidance: string): AssembledMessage[] {
  if (!guidance.trim()) return [...messages];
  return [
    ...messages,
    { role: "assistant", content: rejected ? `${REJECTED_DRAFT_LABEL}\n${rejected}` : REJECTED_DRAFT_LABEL },
    { role: "system", content: buildGuidedSwipeDirective(guidance) },
  ];
}

/** The two messages appendGuidedSwipe added, as trace blocks, so the stored trace and request match what was sent. */
export function guidedBlocks(added: readonly AssembledMessage[]): TraceBlock[] {
  return added.map((m, i) => ({ source: { kind: i === 0 ? "guided-draft" : "guided-directive" }, role: m.role, tokens: countText(m.content) }));
}
