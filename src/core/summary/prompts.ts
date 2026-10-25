/**
 * What the summary model is asked (RoleCall `lib/summary/summary-backfill.ts` and `hooks/useSceneSummary.ts:575-612, 703-760`, rc-parity 08): the built-in prompts for a first summary, a refresh (Rolling recap)
 * and an extension (Growing timeline), the per-exchange line and the whole-history backfill, the template variables a person's own prompt may use, and the checks on a backfill's answer. The wording is
 * RoleCall's, verbatim, because people's own templates are written against it. Pure: strings in, strings out.
 */

export type BackfillMode = "replace" | "additive" | "pair";

export const FIRST_PROMPT = `Summarize this chat between the user and {{characterName}} in 2-3 sentences. Focus on key events, character interactions, and plot developments.

Recent messages:
{{conversationHistory}}

Summary:`;

export const REFRESH_PROMPT = `Refresh the compact chat summary below using the recent messages. Preserve still-relevant historical events, relationships, decisions, and unresolved threads, while rewriting the COMPLETE result into a concise 2-3 sentence summary.

EXISTING SUMMARY:
{{existingSummary}}

RECENT MESSAGES:
{{conversationHistory}}

COMPLETE REPLACEMENT SUMMARY:`;

export const EXTEND_PROMPT = `You are updating a chat summary. Add a brief (1-2 sentence) summary of the NEW messages below to the existing summary.

EXISTING SUMMARY:
{{existingSummary}}

NEW MESSAGES:
{{conversationHistory}}

Respond with the COMPLETE updated summary (existing + new). Keep it concise but informative.`;

export const PAIR_PROMPT = "Summarize what changed in this single roleplay exchange. Focus on a key action, revelation, decision, or emotional beat. Use present tense.";

/** The built-in prompt for a rolling run: a first summary, a refresh of the existing one, or its extension. */
export function rollingPrompt(mode: "replace" | "additive", hasExisting: boolean): string {
  if (!hasExisting) return FIRST_PROMPT;
  return mode === "additive" ? EXTEND_PROMPT : REFRESH_PROMPT;
}

/** A template with its variables filled: `{{characterName}}`, `{{conversationHistory}}` (or `{{messages}}`) and `{{existingSummary}}`. A template with no history variable gets the history appended. */
export function renderTemplate(a: { template: string; characterName: string; conversationHistory: string; existingSummary?: string }): string {
  const accepts = a.template.includes("{{conversationHistory}}") || a.template.includes("{{messages}}");
  const complete = accepts ? a.template : `${a.template.trim()}\n\nConversation history:\n{{conversationHistory}}\n\nSummary:`;
  return complete
    .replace(/\{\{characterName\}\}/g, () => a.characterName)
    .replace(/\{\{conversationHistory\}\}/g, () => a.conversationHistory)
    .replace(/\{\{messages\}\}/g, () => a.conversationHistory)
    .replace(/\{\{existingSummary\}\}/g, () => a.existingSummary ?? "");
}

/** One exchange for Every exchange: the person's template (or RoleCall's line), the two messages, and the demand for exactly one sentence. */
export function pairPrompt(a: { template: string; characterName: string; userMessage: string; assistantMessage: string }): string {
  const pair = `[user]: ${a.userMessage}\n[assistant]: ${a.assistantMessage}`;
  const complete = [
    a.template.trim(),
    a.template.includes("{{userMessage}}") ? "" : "User message:\n{{userMessage}}",
    a.template.includes("{{aiMessage}}") ? "" : "{{characterName}} response:\n{{aiMessage}}",
    "Return exactly one concise summary sentence with no preamble, quotes, or turn number.",
  ].filter(Boolean).join("\n\n");
  return complete
    .replace(/\{\{characterName\}\}/g, () => a.characterName)
    .replace(/\{\{userMessage\}\}/g, () => a.userMessage)
    .replace(/\{\{aiMessage\}\}/g, () => a.assistantMessage)
    .replace(/\{\{conversationHistory\}\}/g, () => pair)
    .replace(/\{\{messages\}\}/g, () => pair)
    .replace(/\{\{existingSummary\}\}/g, "");
}

/** A model's one-sentence line, tidied: quotes and runs of whitespace gone. */
export const tidyLine = (text: string): string => text.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim();

/** The turn number the next per-exchange line takes: one past the highest `Turn N:` already in the summary. */
export function nextTurn(existing: string): number {
  const numbers = Array.from(existing.matchAll(/^Turn\s+(\d+):/gm)).map((m) => Number(m[1])).filter(Number.isInteger);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

/** The prompt that rebuilds a summary from the whole history (RoleCall `buildSummaryBackfillPrompt`): the person's template is used for the rolling modes and added as guidance for Every exchange, which owns the numbered output. */
export function backfillPrompt(a: { mode: BackfillMode; characterName: string; conversationHistory: string; customPrompt?: string; startTurn?: number; pairCount?: number }): string {
  const startTurn = a.startTurn ?? 1;
  const finalTurn = a.pairCount ? startTurn + a.pairCount - 1 : startTurn + 1;
  const example = finalTurn === startTurn ? `Turn ${startTurn}: ...` : `Turn ${startTurn}: ...\nTurn ${finalTurn}: ...`;
  const builtIn = a.mode === "pair"
    ? `Backfill an append-only summary of this roleplay chat between the user and {{characterName}}.

For every COMPLETE user-to-{{characterName}} exchange, write exactly one concise line in chronological order. Number the lines consecutively from Turn ${startTurn} through Turn ${finalTurn}. Focus on what changed: a key action, revelation, decision, or emotional beat. Skip system messages and any final user message that has no assistant response.

Use this exact format with no preamble:
${example}

Conversation history:
{{conversationHistory}}`
    : a.mode === "additive"
      ? `Backfill a chronological, cumulative summary of this entire roleplay chat between the user and {{characterName}}. Preserve the order of important events, relationship changes, decisions, and unresolved threads. Write the complete standalone summary as though each older exchange had been added as it happened. Keep it concise and include no preamble.

Conversation history:
{{conversationHistory}}

Summary:`
      : `Summarize the entire roleplay chat between the user and {{characterName}}. Focus on key events, character interactions, relationship changes, unresolved threads, decisions, and important details that should be remembered later. Keep it concise and include no preamble.

Conversation history:
{{conversationHistory}}

Summary:`;
  const guidance = a.mode === "pair" && a.customPrompt?.trim()
    ? `\n\nAdditional user-authored summary instructions:\n${a.customPrompt.replace(/\{\{userMessage\}\}/g, "the user message in each exchange").replace(/\{\{aiMessage\}\}/g, "the assistant response in each exchange")}`
    : "";
  return renderTemplate({ template: a.mode === "pair" ? `${builtIn}${guidance}` : a.customPrompt || builtIn, characterName: a.characterName, conversationHistory: a.conversationHistory });
}

/** Two partial summaries made from the halves of a history that would not fit one call, asked to become one. */
export const combinePrompt = (earlier: string, later: string): string =>
  `Combine the chronological partial summaries below into one complete roleplay summary. Preserve the order of events, key character interactions, relationship changes, decisions, unresolved threads, and details needed later. Do not mention that the source was split.\n\nEARLIER PART:\n${earlier}\n\nLATER PART:\n${later}\n\nCOMPLETE SUMMARY:`;

export interface Said { role: string; content: string }

/** The complete user-to-assistant exchanges of a history, each as its user messages then the reply; a user message with no reply yet belongs to none. */
export function exchangesOf(messages: readonly Said[]): Said[][] {
  const out: Said[][] = [];
  let waiting: Said[] = [];
  for (const m of messages) {
    if (m.role === "user") waiting.push(m);
    else if (m.role === "assistant" && waiting.length > 0) { out.push([...waiting, m]); waiting = []; }
  }
  return out;
}

/** A per-exchange backfill must come back with exactly one `Turn N:` line per exchange, numbered in order from `startTurn`; anything else is refused and the old summary stays (RoleCall `assertCompleteBackfillOutput`). */
export function checkPairBackfill(summary: string, expectedPairs: number, startTurn = 1): string | null {
  const lines = summary.match(/^Turn\s+(\d+):/gm) ?? [];
  if (lines.length !== expectedPairs) return `Per-exchange backfill returned ${lines.length} of ${expectedPairs} turns; the existing summary was left unchanged.`;
  const inOrder = lines.every((line, i) => Number(line.match(/^Turn\s+(\d+):/)?.[1]) === startTurn + i);
  return inOrder ? null : "Per-exchange backfill turns were not numbered in order; the existing summary was left unchanged.";
}
