/**
 * Reasoning Effort at the provider boundary (RoleCall's lib/providers/adapters/reasoning-effort.ts, itself
 * SillyTavern's tables): one pure translation per wire dialect, so each request builder only places the result.
 * Auto sends nothing. A model a dialect cannot take the knob on gets nothing rather than a request the API
 * refuses. Claude's disable switch on Auto is decided by claudeCanDisable below and sent by anthropic-request.ts:
 * 4.6+ models think by default when `thinking` is left out, so Auto sends `thinking: disabled` to them, as RoleCall does.
 */
import type { ReasoningEffort } from "../contracts/provider";

const picked = (effort: ReasoningEffort | undefined): Exclude<ReasoningEffort, "auto" | "min" | "max"> | undefined => {
  const e = effort === "min" ? "minimal" : effort === "max" ? "xhigh" : effort;
  return e === undefined || e === "auto" ? undefined : e;
};

/** OpenAI: only the models that take `reasoning_effort` (o-series, gpt-5), minimal and xhigh clamped to what the model accepts, "none" left off. */
export function openAIEffort(model: string, effort: ReasoningEffort | undefined): string | undefined {
  const e = picked(effort);
  const m = model.toLowerCase();
  if (!e || e === "none" || !/^(o\d|gpt-5)/.test(m)) return undefined;
  if (m === "gpt-5.3-chat-latest") return "medium";
  if (e === "minimal") return /^gpt-5(-|$)/.test(m) ? "minimal" : "low";
  if (e === "xhigh") return /^gpt-5\.[4-9]/.test(m) || /codex-max/.test(m) ? "xhigh" : "high";
  return e;
}

/** OpenRouter: the level under `reasoning.effort`, any explicit level as chosen. */
export const openRouterEffort = (effort: ReasoningEffort | undefined): string | undefined => picked(effort);

/** Google's OpenAI-compatible endpoint: Gemini 2.5 and 3 models, xhigh as high, "none" only where thinking can be switched off (flash). */
export function geminiEffort(model: string, effort: ReasoningEffort | undefined): string | undefined {
  const e = picked(effort);
  const m = model.toLowerCase().replace(/^models\//, "");
  if (!e || !/^gemini-(2\.5|3)/.test(m)) return undefined;
  if (e === "none") return /flash/.test(m) ? "none" : undefined;
  return e === "xhigh" ? "high" : e;
}

const claudeId = (model: string): string => model.toLowerCase().replace(/\./g, "-");
/** Claude Opus 4.6+, Sonnet 4.6+ and the 5 series take adaptive thinking, with an effort. */
const adaptive = (id: string): boolean => /claude-(?:(?:fable|mythos|opus|sonnet)-5(?:-|$)|mythos-preview(?:-|$)|opus-4-(?:[6-9]|\d{2,})|sonnet-4-(?:[6-9]|\d{2,}))/.test(id);
const budgeted = (id: string): boolean => /claude-3-7|claude-(?:opus|sonnet|haiku)-4/.test(id);
const xhighOk = (id: string): boolean => /claude-(?:fable|mythos|opus|sonnet)-5(?:-|$)|claude-opus-4-(?:[7-9]|\d{2,})/.test(id);

/**
 * Models that think by default when `thinking` is left out, yet can be told not to: RoleCall sends `thinking: disabled` to them
 * when no level and no budget is set (anthropic.ts:347-361), so a request that asked for no thinking does not get adaptive
 * thinking the model chose, with its cost and its clash with a preset's own thinking block. The always-on models refuse the switch.
 */
export const claudeCanDisable = (model: string): boolean => adaptive(claudeId(model)) && !/claude-(?:(?:fable|mythos)-5(?:-|$)|mythos-preview(?:-|$))/.test(claudeId(model));

export type ClaudeThinking = { budget: number } | { adaptive: true; effort: "low" | "medium" | "high" | "xhigh" | "max" } | null;

/** Anthropic: a thinking budget (a share of max_tokens, at least 1,024, at most 21,333 when not streaming) or, on the newest models, adaptive thinking with an effort. */
export function claudeThinking(model: string, effort: ReasoningEffort | undefined, maxTokens: number, stream: boolean): ClaudeThinking {
  const e = picked(effort);
  const id = claudeId(model);
  if (!e || e === "none") return null;
  if (adaptive(id)) {
    if (e === "minimal" || e === "low") return { adaptive: true, effort: "low" };
    return { adaptive: true, effort: e === "xhigh" ? (xhighOk(id) ? "xhigh" : "max") : e };
  }
  if (!budgeted(id)) return null;
  const share = { minimal: 0, low: 0.1, medium: 0.25, high: 0.5, xhigh: 0.95 }[e];
  const budget = Math.max(Math.floor(maxTokens * share), 1024);
  return { budget: stream ? budget : Math.min(budget, 21_333) };
}
