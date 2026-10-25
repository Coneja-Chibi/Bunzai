/**
 * The one place a model id is read to answer "what is this model". Three call sites used to sniff
 * model ids with independently hand-rolled regex (cache pricing, token-estimate priors, prefill
 * support), and they had already drifted: the pricing/backend classifier never recognized the
 * fable/mythos Claude rename at all, and the prefill check's "is this Claude" gate used a bare
 * `indexOf("claude")`, so a fable/mythos id fell through to "takes a prefill" when the model line it
 * renames (Claude 4.7+) actually refuses one - a live request-shape bug, not just a style drift.
 *
 * `claudeVersion` only PARSES a version out of a Claude-family id (fable/mythos included); it does
 * not decide any threshold. The tokenizer-legacy cutoff (4.7) and the prefill-refusal cutoff (4.6)
 * are genuinely different policies that happen to read the same version number, so each caller still
 * applies its own `>=` test against the parsed version (AGENTS.md rule 12: no behavior folded into a
 * shared helper unless every caller actually wants it).
 */

export type ModelFamily =
  | "claude" | "claude-legacy"
  | "openai" | "openai-legacy"
  | "gemini" | "deepseek" | "qwen" | "llama" | "glm" | "kimi" | "mistral" | "grok"
  | "unknown";

/** True when `id` is a Claude-family id, including the fable/mythos rename. */
const isClaudeFamily = (id: string): boolean => /claude|anthropic|\bfable\b|\bmythos\b/.test(id);

/**
 * The {major, minor} version of a Claude-family model id, or null when `id` is not Claude-family, or
 * carries no parseable version. The fable/mythos rename has no numeric id of its own; it names the
 * model line Anthropic ships instead of "claude" going forward, so it parses as the newest tier (same
 * generation as claude-5, same as every caller's existing special case for it). A long non-version
 * digit run (an ISO date suffix like "claude-opus-4-20250514") is never misread as a minor version.
 */
export function claudeVersion(modelId: string): { major: number; minor: number } | null {
  const id = modelId.toLowerCase();
  if (!isClaudeFamily(id)) return null;
  if (/\b(fable|mythos)\b/.test(id) && !id.includes("claude")) return { major: 5, minor: 0 };
  const m = id.match(/claude-(?:(?:opus|sonnet|haiku|instant)-)?(\d+)(?:[.-](\d+))?/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = m[2] !== undefined && m[2].length <= 2 ? Number(m[2]) : 0;
  return { major, minor };
}

/**
 * The family a model id belongs to, read from the id alone. Aggregator ids ("anthropic/claude-...",
 * "meta-llama/llama-4-...") match by what follows the slash as well. Claude models before Opus 4.7
 * keep the older tokenizer (tokenizer vintage only - NOT the same cutoff a prefill check uses).
 */
export function classifyModelId(modelId: string): ModelFamily {
  const id = modelId.toLowerCase();
  if (isClaudeFamily(id)) {
    const v = claudeVersion(id);
    const legacy = v !== null && (v.major < 4 || (v.major === 4 && v.minor < 7));
    return legacy ? "claude-legacy" : "claude";
  }
  if (/\bgpt-(3\.5|4)(?![.o\d])|gpt-4-|gpt-4$|text-davinci|gpt-3/.test(id)) return "openai-legacy";
  if (/\bgpt|\bo[1-9](-|$)|chatgpt|codex|openai\//.test(id)) return "openai";
  if (/gemini|gemma|google\//.test(id)) return "gemini";
  if (/deepseek/.test(id)) return "deepseek";
  if (/qwen|qwq|dashscope/.test(id)) return "qwen";
  if (/llama|meta-/.test(id)) return "llama";
  if (/glm|zhipu|z-ai|chatglm/.test(id)) return "glm";
  if (/kimi|moonshot/.test(id)) return "kimi";
  if (/mistral|mixtral|codestral|ministral|magistral|pixtral|devstral/.test(id)) return "mistral";
  if (/grok|x-ai|xai/.test(id)) return "grok";
  return "unknown";
}
