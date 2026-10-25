/**
 * Smart Recovery (RoleCall's reasoning-rescue.ts, called from the worker's recoverMissingReasoningWithHelper): the pure
 * half. A reply with no thinking of its own, when the scene's recent replies had some, may have its thinking run into it
 * with no wrapper. A helper model is asked for the first words of the visible reply; those words must be found once,
 * verbatim, not at the very start, with real text on both sides. Only then does a boundary exist, and it is a character
 * offset kept with the reply (the stored text is never changed). The helper supplies no prose, so nothing can be invented.
 */
import { escapeRegex } from "./regex/escape";
import { splitReasoning, type ReasoningFormat } from "./reasoning-tags";

/** A reply this short has no plausible reasoning and reply to split. */
export const RECOVERY_MIN_LENGTH = 120;
const HISTORY_WINDOW = 8;
/** Only the ends of a long reply are sent: the visible reply is at the end, the opening shows the reasoning. */
const SAMPLE_LENGTH = 6000;

/** One earlier reply, as far as the check needs to know it. `native`: it carries provider reasoning. */
export interface RescueReply { role: string; content: string; model?: string; native?: boolean }

const hadThinking = (reply: RescueReply, format: ReasoningFormat, model: string | undefined): boolean => {
  // Evidence tied to another model does not count for this one; a tagged reply's own thinking is the scene's and counts.
  const native = reply.native === true && (!model || !reply.model || reply.model === model);
  return native || splitReasoning(reply.content, format).thinking !== "";
};

/** The last reply, or at least two of the recent eight, carried thinking: its absence now is odd. */
export function hasHistoricalReasoning(history: readonly RescueReply[], format: ReasoningFormat, model?: string): boolean {
  const recent = history.filter((m) => m.role === "assistant").slice(-HISTORY_WINDOW).map((m) => hadThinking(m, format, model));
  return recent.length > 0 && (recent[recent.length - 1]! || recent.filter(Boolean).length >= 2);
}

/** Smart Recovery belongs to Auto: Only these and Off never guess. */
export function shouldAttemptRecovery(input: { history: readonly RescueReply[]; content: string; format: ReasoningFormat; model?: string; native?: string }): boolean {
  if ((input.format.capture?.mode ?? "auto") !== "auto") return false;
  if (input.native?.trim()) return false;
  if (splitReasoning(input.content, input.format).thinking !== "") return false;
  return input.content.trim().length >= RECOVERY_MIN_LENGTH && hasHistoricalReasoning(input.history, input.format, input.model);
}

/** RoleCall's classifier prompt (buildSmartReasoningRecoveryMessages), word for word. */
export function recoveryMessages(blob: string): Array<{ role: "system" | "user"; content: string }> {
  const sample = blob.length > SAMPLE_LENGTH ? `${blob.slice(0, SAMPLE_LENGTH / 2)}\n[... middle omitted for boundary classification ...]\n${blob.slice(-SAMPLE_LENGTH / 2)}` : blob;
  return [
    { role: "system", content: "You are a conservative text-boundary classifier. You never roleplay, rewrite, summarize, or invent text. When uncertain, output NONE." },
    {
      role: "user",
      content: "A response may contain private reasoning that was not separated into its reasoning channel. This check was triggered either because "
        + "an explicit reasoning tag such as <think> remained unplaced, or because recent responses established a reasoning pattern that suddenly stopped. "
        + "Decide whether the BEGINNING unmistakably contains private chain-of-thought, planning, self-instructions, or hidden deliberation "
        + "that is followed by the actual user-visible response. Do NOT classify narration, scene-setting, dialogue, headings intended for "
        + "the user, or a stylistic preamble as private reasoning. If there is no high-confidence private-to-visible transition, output the "
        + "single word NONE. If there is one, copy the FIRST 6 TO 10 WORDS of the visible response exactly as written, character for character. "
        + "Output only those exact words and nothing else."
        + `\n\n--- TEXT ---\n${sample}\n--- END ---`,
    },
  ];
}

const words = (s: string): number => (s.match(/\b[\w'-]+\b/g) ?? []).length;

/**
 * The offset where the visible reply begins, from the helper's answer, or null for no move: NONE, an anchor not found, found
 * at the very start, found more than once (the wrong repeat would hide reply text), or a split that leaves under 24
 * characters and 4 words of reasoning or 3 words of reply.
 */
export function anchorSplit(blob: string, answer: string | null | undefined): number | null {
  const anchor = (answer ?? "").trim().split("\n")[0]!.replace(/^["'«»“”‘’\s]+|["'«»“”‘’\s]+$/g, "").trim();
  if (!anchor || /^none$/i.test(anchor)) return null;
  const re = new RegExp(anchor.split(/\s+/).map(escapeRegex).join("\\s+"), "gi");
  const found = re.exec(blob);
  if (!found || found.index <= 0 || re.exec(blob)) return null;
  const lead = blob.slice(0, found.index).trim();
  const rest = blob.slice(found.index).trim();
  return lead.length < 24 || words(lead) < 4 || words(rest) < 3 ? null : found.index;
}
