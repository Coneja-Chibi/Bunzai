/**
 * What every Final Cut prompt shares (RoleCall lib/post-gen-actions/prompts.ts:30-105): the recent-messages block, the directive that
 * lets a pass say it had nothing to change, and the shapes the builders take and return. RoleCall's file carries mojibake in the text it
 * sends (an em dash and the bullet read back as Latin-1); these builders send plain hyphens.
 */
import { MAX_CONTEXT_MESSAGES, contextMessagesOf } from "./pass";

export interface PromptMessage { role: "system" | "user"; content: string }

/** Who and what the pass is working beside: the character, who spoke, and the take's last messages (newest last). */
export interface PromptContext {
  characterName?: string;
  role?: "user" | "assistant" | "system";
  recentMessages?: ReadonlyArray<{ role: string; content: string }>;
}

const MAX_CHARS_PER_MESSAGE = 600;

const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The honest no-op: the model may say the input needs nothing, and in tool-call mode must still review every rule. */
export function noChangesDirective(passLabel: string, toolCall: boolean): string {
  return toolCall
    ? `If after careful review you find the input genuinely needs no ${passLabel} changes (already meets every criterion), set \`no_changes_needed: true\` and echo the input verbatim in the body field. Otherwise set \`no_changes_needed: false\` and emit your edits in the body field. EITHER WAY, you MUST populate \`rule_review\` with one entry per rule/bank in your prompt's rules section - never skip rules. State your verdict (clean / minor / ignored / applied) and a one-sentence reasoning for each. When you applied an edit triggered by a rule, the reasoning explains which criterion fired. When you decided not to act on a rule, the reasoning explains what you considered. Saying "I had nothing to do" is valid only when accompanied by full per-rule review.`
    : `If after careful review you find the input genuinely needs no ${passLabel} changes, prefix your response with \`[NO_CHANGES_NEEDED]\` and still emit [CHANGELOG] (empty or with a single explanatory entry) and the original body verbatim under the body section.`;
}

/** The `<recent_outputs>` block for a system prompt, or "" when there is nothing to show. */
export function recentContextBlock(context: PromptContext | undefined, windowSize: number | undefined, framing: string): string {
  const recent = (context?.recentMessages ?? []).slice(-contextMessagesOf(windowSize));
  if (recent.length === 0) return "";
  const rows = recent.map((m, i) => `  <msg n="${i - recent.length + 1}" role="${m.role}">${escapeXml(m.content.trim().slice(0, MAX_CHARS_PER_MESSAGE))}</msg>`).join("\n");
  return ["", `Recent conversation context (last ${recent.length} messages, oldest first). ${framing}`, `<recent_outputs n="${recent.length}">`, rows, "</recent_outputs>"].join("\n");
}

/** How many of the take's messages a run should hand its passes: the most any pass can ask for. */
export const CONTEXT_FETCH = MAX_CONTEXT_MESSAGES;
