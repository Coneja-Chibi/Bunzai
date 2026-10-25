/**
 * The Prompt Inspector's one pause gate (rc-parity 03 F16): a turn that asked to be reviewed stops here,
 * after the request is built and before anything is written or sent, until the page answers Send (with the
 * person's edits, if any) or Cancel. RoleCall pauses its durable job at the provider egress (coordinator.ts
 * coordinateModelCall); Bunraku's turn runs in this process, so the wait is a promise, not a polled row.
 * A Stop, or the page leaving, settles it as Cancel, so nothing can be left waiting.
 */
import { turnGate } from "./scene-turn-gate";

/** Send keeps the request, replacing the text of message `index` for each edit; Cancel ends the turn. */
export type ReviewDecision = { kind: "send"; edits: Readonly<Record<number, string>> } | { kind: "cancel" };

const gate = turnGate<ReviewDecision>({ kind: "cancel" });

/** Resolves with the person's answer; a signal that aborts first answers Cancel. */
export const awaitReview = gate.wait;

/** Answers a waiting review; false when the turn is not waiting for one (or belongs to another scene). */
export const answerReview = (chatId: string, turnId: string, decision: ReviewDecision): boolean => gate.answer(chatId, turnId, decision);

/** Each edit replaces the text of the message at its index; an index past the list is ignored, the rest is untouched. */
export function applyEdits<T extends { content: string }>(list: readonly T[], edits: Readonly<Record<number, string>>): T[] {
  return list.map((m, i) => (edits[i] === undefined ? m : { ...m, content: edits[i]! }));
}
