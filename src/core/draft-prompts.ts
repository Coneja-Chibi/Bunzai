/**
 * The text the draft tools send (studio/scene-draft.ts), in one place so the Writing Tools tab can show
 * it read-only. Impersonation is RoleCall's `prompt-assembly.ts` section 11; the editors are the fixed
 * prompts of RoleCall's `app/api/chat/guides/{spellcheck,correct,selection-rewrite}/route.ts` and
 * `lib/scene/selection-rewrite-helpers.ts`. Deviations: the perspective line (RoleCall's pill is a dead
 * control) and Polish Input, which says the text is the player's draft (RoleCall calls it the character's).
 */
import { TOOL_IDS, type ToolId } from "./final-cut/pass";

export const PERSPECTIVES = ["1st", "2nd", "3rd"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];

/** One line appended after the preset's impersonation text, so the pill changes the request. */
export const PERSPECTIVE_LINES: Readonly<Record<Perspective, string>> = {
  "1st": "Write in first person (I, we).",
  "2nd": "Write in second person (you).",
  "3rd": "Write in third person, by name.",
};

/** Used when the preset's impersonation prompt is blank (SillyTavern's default). */
export const DEFAULT_IMPERSONATION_PROMPT =
  "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]";

/** The final system message of an impersonation: the expanded prompt, the perspective, then the person's outline as a hint. */
export function impersonationText(expanded: string, perspective: Perspective, brief: string): string {
  const hint = brief.trim();
  const line = `Hint for this reply (treat as the user's intent, expand into a full message in their voice — do NOT echo this verbatim):\n${hint}`; // emdash-ok: RoleCall's exact prompt text
  return `${expanded}\n\n${PERSPECTIVE_LINES[perspective]}${hint ? `\n\n${line}` : ""}`;
}

/** Every editor tool is two messages: this system text and the message to work on. */
export interface DraftPrompt {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}

const SPELLCHECK_RULES = (voice: string) => `Focus on:
1. Grammar and spelling corrections
2. Improving sentence flow and readability
3. Fixing awkward phrasing
4. Maintaining the ${voice} voice and writing style
5. Keeping the meaning intact

IMPORTANT: Make MINIMAL changes. Only fix obvious errors and improve clarity. Do NOT rewrite the message or change the writing style significantly unless it's clearly improving readability.

Return ONLY the polished message, no explanations.`;

/** The Correction Tools' Spellcheck: a reply in the character's voice. */
export function spellcheckPrompt(character: string, message: string): DraftPrompt {
  return {
    system: `You are an expert editor and proofreader. Your task is to polish and improve a roleplay message.\n\nCharacter: ${character || "The character"}\n\n${SPELLCHECK_RULES("character's")}`,
    user: `Original message:\n\n${message}\n\nPolished message:`,
    temperature: 0.2,
    maxTokens: 2000,
  };
}

/** Polish Input: the same prompt, but the text is the player's own draft, not the character's. */
export function polishPrompt(player: string, text: string): DraftPrompt {
  return {
    system: `You are an expert editor and proofreader. Your task is to polish and improve a roleplay message.\n\nThe message is the player's own draft, written as ${player || "the player"}. It is not the character's.\n\n${SPELLCHECK_RULES("player's")}`,
    user: `Original message:\n\n${text}\n\nPolished message:`,
    temperature: 0.2,
    maxTokens: 2000,
  };
}

export function correctPrompt(character: string, guideline: string, message: string): DraftPrompt {
  return {
    system: `You are an expert editor helping to improve a roleplay message.

Character: ${character || "The character"}

Correction Guidelines:
${guideline}

Your task is to rewrite the message to follow these guidelines while:
1. Preserving the character's voice and personality
2. Maintaining the original meaning and intent
3. Keeping the same general length unless the guidelines specify otherwise
4. Only changing what's necessary to meet the correction guidelines

Return ONLY the corrected message, no explanations.`,
    user: `Original message:\n\n${message}\n\nCorrected message:`,
    temperature: 0.3,
    maxTokens: 2000,
  };
}

/** The selection rewrites: the Final Cut tool ids (core/final-cut/pass.ts owns them) but Correction, which runs on the whole message. */
export type RewriteAction = Exclude<ToolId, "correct">;
export const REWRITE_ACTIONS: readonly RewriteAction[] = TOOL_IDS.filter((id): id is RewriteAction => id !== "correct");

/** The longest Custom instruction a rewrite takes. */
export const CUSTOM_INSTRUCTION_MAX = 2000;

const OPERATIONS: Readonly<Record<Exclude<RewriteAction, "custom">, string>> = {
  rewrite: "Rewrite the selected passage for clarity, flow, and prose quality. Keep roughly the same length and preserve all facts, intent, speaker voice, POV, tense, names, and formatting.",
  expand: "Expand the selected passage with concrete detail, rhythm, or action that is already implied by the message. Do not invent new outcomes, facts, locations, objects, injuries, relationship changes, or lore. Aim for no more than about twice the selected length.",
  reduce: "Reduce the selected passage into tighter prose. Preserve all facts, intent, speaker voice, POV, tense, names, and necessary formatting while cutting redundancy and filler.",
};

/** RoleCall's Custom operation (selection-rewrite-helpers.ts:24-29): the person's instruction, under the same voice rules. */
const customOperation = (instruction: string): string =>
  `Rewrite the selected passage according to the user's instruction below. Apply the instruction faithfully while preserving the speaker voice, POV, tense, names, and necessary formatting unless the instruction explicitly asks to change them. Do not invent new outcomes, facts, locations, objects, injuries, relationship changes, or lore beyond what the instruction calls for.

User instruction:
${instruction}`;

export function rewritePrompt(character: string, action: RewriteAction, message: string, selected: string, instruction = ""): DraftPrompt {
  return {
    system: `You are an expert line editor for roleplay prose.

Character: ${character || "the character"}

The user selected one passage inside a full message. Your job is to produce a replacement for ONLY that selected passage.

Operation:
${action === "custom" ? customOperation(instruction) : OPERATIONS[action]}

Rules:
1. Return ONLY the replacement text for the selected passage.
2. Do not return the full message.
3. Do not explain your changes.
4. Do not wrap the answer in quotes, markdown fences, XML, or labels.
5. Preserve markdown, macros, commands, VN/action tags, and structured syntax that appear inside the selected passage unless the operation requires removing redundant prose around them.
6. Use the full message only as context. Never rewrite surrounding text.`,
    user: `Full message for context:\n\n${message}\n\nSelected passage:\n\n${selected}\n\nReplacement passage:`,
    temperature: action === "rewrite" ? 0.35 : 0.4,
    maxTokens: Math.min(Math.max(Math.ceil(selected.length / 2), 300), 2000),
  };
}

/** A rewrite's reply without a code fence or a leading label the model added (RoleCall's cleanReplacement). */
export function cleanReplacement(raw: string): string {
  let replacement = raw.trim();
  const fence = replacement.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  if (fence) replacement = fence[1]!.trim();
  return replacement.replace(/^(?:replacement|rewritten selection|rewrite|expanded selection|reduced selection|custom rewrite)\s*:\s*/i, "").trim();
}

/** The passage a person highlighted in a message: where it starts and ends, and its text. */
export interface TextRange {
  start: number;
  end: number;
  text: string;
}

/** The highlighted range clamped to the message; null when it holds only whitespace (RoleCall's createTextSelectionRange). */
export function textRange(content: string, rawStart: number, rawEnd: number): TextRange | null {
  const start = Math.max(0, Math.min(rawStart, rawEnd, content.length));
  const end = Math.max(0, Math.min(Math.max(rawStart, rawEnd), content.length));
  const text = content.slice(start, end);
  return text.trim() ? { start, end, text } : null;
}

/** The message with the range replaced; refuses a range outside it (RoleCall's replaceSelectionRange). */
export function replaceRange(content: string, range: TextRange, replacement: string): string {
  if (range.start < 0 || range.end < range.start || range.end > content.length) throw new Error("the selection is outside the message");
  return content.slice(0, range.start) + replacement + content.slice(range.end);
}

/** Where a highlighted string sits in a message, when it sits in exactly one place (RoleCall's findUniqueTextSelectionRange); null otherwise. */
export function uniqueRange(content: string, selected: string): TextRange | null {
  for (const text of [selected, selected.trim()]) {
    const start = text ? content.indexOf(text) : -1;
    if (start !== -1 && content.indexOf(text, start + text.length) === -1) return { start, end: start + text.length, text };
  }
  return null;
}
