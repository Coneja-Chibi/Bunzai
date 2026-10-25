/**
 * Core: the four controls people use most (RoleCall's CORE_SAMPLERS, lib/ai/samplers/core.ts), here the
 * scene's own sampler overrides (ChatStore rule 19), not a second store. Copy and ranges are RoleCall's;
 * `default` is where a slider rests when neither the preset nor the scene sets a value, which sends
 * nothing (RoleCall's 0.85 and 2000 are invented values a provider never asked for).
 */
import type { ParamDef } from "./types";

export const CORE_PARAMS: readonly ParamDef[] = [
  {
    id: "temperature", label: "Temperature", group: "core", kind: "range", min: 0, max: 2, step: 0.01, default: 1, aliases: ["temperature"],
    description: "How adventurous the writing is. Lower stays predictable; higher takes more surprising turns.",
  },
  {
    id: "top_p", label: "Top P", group: "core", kind: "range", min: 0, max: 1, step: 0.01, default: 1, aliases: ["top_p"],
    description: "How wide a range of likely words the model picks from. 1.0 allows all of them.",
  },
  {
    id: "top_k", label: "Top K", group: "core", kind: "integer", min: 0, max: 500, step: 1, default: 0, aliases: ["top_k"],
    description: "Only consider this many of the most likely next words. 0 turns the limit off.",
  },
  {
    id: "max_tokens", label: "Max reply length", group: "core", kind: "integer", min: 16, max: 128_000, step: 1, default: 8_192, aliases: ["max_tokens"],
    description: "The longest reply the model may write, in tokens.",
  },
];

/** A Core parameter's field on the scene's samplers (ChatPresetSamplers). */
export const CORE_FIELD = { temperature: "temperature", top_p: "topP", top_k: "topK", max_tokens: "maxTokens" } as const;
export type CoreId = keyof typeof CORE_FIELD;
