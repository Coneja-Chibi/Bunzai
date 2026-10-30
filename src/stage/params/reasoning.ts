/**
 * Reasoning Effort (RoleCall's reasoning_effort sampler, lib/ai/samplers/definitions.ts:366): how hard the
 * model thinks before writing, as the scene's own setting (ChatStore rule 37). Auto sends nothing. The
 * description names only the connections whose request builders send it (stage/provider/reasoning-wire.ts).
 */
import type { ParamDef } from "./types";

export const REASONING_EFFORTS = ["auto", "none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffortChoice = (typeof REASONING_EFFORTS)[number];

/** RoleCall's select labels, word for word. */
export const REASONING_EFFORT_OPTIONS: readonly { value: ReasoningEffortChoice; label: string }[] = [
  { value: "auto", label: "Auto - Provider default / omit knob" },
  { value: "none", label: "None - Disable native reasoning where supported" },
  { value: "minimal", label: "Minimal - Smallest supported reasoning budget" },
  { value: "low", label: "Low - Light reasoning (~10% of max_tokens)" },
  { value: "medium", label: "Medium - Balanced reasoning (~25% of max_tokens)" },
  { value: "high", label: "High - Deep reasoning (~50% of max_tokens)" },
  { value: "xhigh", label: "X-High - Maximum provider-managed reasoning" },
];

/** The connection kinds (Kit spokes) whose request builders send the level; the rest ignore it. */
export const EFFORT_KINDS: readonly string[] = ["anthropic", "openai", "openrouter", "google", "ollama"];

export const REASONING_PARAMS: readonly ParamDef[] = [
  {
    id: "reasoning_effort", label: "Reasoning Effort", group: "reasoning", kind: "select", default: "auto",
    description: "How hard the model thinks before writing. This is NATIVE reasoning: the model runs a private thinking pass at the API level, separate from any <think> blocks in your preset. Sent to Anthropic, OpenAI, OpenRouter and Google connections, and to Ollama as thinking on or off for a model that thinks; other connections ignore it.",
    notes: "Auto sends nothing. Claude removes temperature, top_p and top_k when thinking is on. Budget percentages are approximate and provider-specific.",
  },
];
