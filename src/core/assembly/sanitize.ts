/**
 * Cleanup passes RoleCall runs on prompt text (ported from `prompt-assembly.ts:4191` and
 * `strip-tool-call-leaks.ts` at the pin). A macro still unresolved after the final pass disappears,
 * and a message left empty is dropped: that is how an unknown macro vanishes from a RoleCall turn.
 * Think-tag stripping is step 2f's, with the rest of reasoning handling; `historyText` is how a history message reads to the model.
 */
import { stripReasoningTags, type ReasoningFormat } from "../reasoning-tags";

/** A `{{...}}` with no nested `{{` or `}}` inside: the innermost layer of a macro. */
const UNRESOLVED_MACRO = /\{\{(?:[^{}]|\{(?!\{)|\}(?!\}))+\}\}/g;

/** RoleCall's final strip: innermost macros first, up to 20 layers, then stray braces and gaps. */
export function stripUnresolvedMacros(text: string, historyMarker: string): string {
  let out = text;
  let before: string;
  let passes = 0;
  do {
    before = out;
    out = out.replace(UNRESOLVED_MACRO, "");
    passes++;
  } while (out !== before && passes < 20);
  return out
    .replace(/(?<!\})\}\}(?!\})/g, "")
    .replace(/(?<!\{)\{\{(?!\{)/g, "")
    .replace(historyMarker, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every tool-call wrapper seen leaking into prose across providers (RoleCall VVS-257). */
const TOOL_CALL_TAGS = ["tool_call", "tool_use", "function_call", "function", "invoke"] as const;
const CLOSED = TOOL_CALL_TAGS.map((tag) => new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, "gi"));
const UNCLOSED = TOOL_CALL_TAGS.map((tag) => new RegExp(`<\\s*${tag}\\b[\\s\\S]*$`, "i"));

/** Removes tool-call markup a model wrote into its prose, closed pairs first, then a cut-off opener. */
export function stripToolCallLeaks(content: string): string {
  if (!content) return content;
  let out = content;
  for (const pattern of CLOSED) out = out.replace(pattern, "");
  for (const pattern of UNCLOSED) out = out.replace(pattern, "");
  return out.replace(/\n{3,}/g, "\n\n");
}

/** A history message as the model and the history macros read it: tool-call leaks out, and an assistant reply's thinking out unless the scene keeps it. */
export function historyText(m: { role: string; content: string; thinkingEnd?: number }, reasoning: ReasoningFormat | undefined, keepThinking: boolean | undefined): string {
  const text = stripToolCallLeaks(m.content);
  return keepThinking || m.role !== "assistant" ? text : stripReasoningTags(text, m.thinkingEnd === undefined ? reasoning : { ...(reasoning ?? { prefix: "", suffix: "", separator: "" }), recoveredEnd: m.thinkingEnd });
}
