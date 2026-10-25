/**
 * Reusable pieces of a spoke's parameter support. A spoke composes its own `scene.support.params`
 * from these and says where each claim comes from; nothing here lists providers. A parameter a
 * provider's own documentation does not list is not claimed.
 */
import { PARAMS } from "./index";
import type { ParamSupport } from "./wire";
import type { ParamValue } from "./types";
import { isRecord } from "../../core/guards";
import { biasFrom, type BiasEntry } from "../../core/tokens/bias";

/** At most `max` strings, for a provider that rejects a longer stop list. */
export const stopList = (key: string, max: number) => ({
  key,
  to: (v: ParamValue) => (Array.isArray(v) && v.length > 0 ? v.slice(0, max) : undefined),
});

/** A scene's Logit Bias entries as the field a provider reads: token id to bias, or id and bias pairs. Refused (undefined) when the model's words cannot be tokenized exactly. */
export const logitBias = (shape: "object" | "pairs" = "object") => ({
  key: "logit_bias",
  to: (v: ParamValue, _all: unknown, model: string) => {
    const entries = isRecord(v) && Array.isArray(v["entries"]) ? (v["entries"] as BiasEntry[]) : [];
    const made = biasFrom(entries, model);
    if ("problem" in made) return undefined;
    return shape === "object" ? made.bias : Object.entries(made.bias).map(([id, b]) => [Number(id), b]);
  },
});

/** OpenAI's chat completions (platform.openai.com/docs/api-reference/chat/create; RoleCall's adaptForOpenAI list). */
export const OPENAI_PARAMS: ParamSupport = {
  frequency_penalty: true, presence_penalty: true, seed: true, n: true, logprobs: true, top_logprobs: true, response_format: true,
  stop: stopList("stop", 4), logit_bias: logitBias(),
};

/** Backends that read the text-generation samplers as sent (llama.cpp, vLLM, ooba, Tabby, Kobold, LM Studio): every parameter, under RoleCall's ids. */
export const OPEN_PARAMS: ParamSupport = {
  ...Object.fromEntries(PARAMS.filter((p) => p.id !== "clear_thinking").map((p) => [p.id, true as const])),
  top_k: true,
  logit_bias: logitBias(),
};

/** The list DRY's sequence breakers are, from the JSON text the card holds (RoleCall's adaptForLlamaCpp). */
const breakerList = (v: ParamValue): string[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(String(v));
    return Array.isArray(parsed) && parsed.every((s) => typeof s === "string") ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** llama.cpp and Ollama (RoleCall's adaptForLlamaCpp): grammar under its own name, a JSON schema wins over it, bias as id and bias pairs. */
export const LOCAL_PARAMS: ParamSupport = {
  ...OPEN_PARAMS,
  grammar_string: { key: "grammar", to: (v, all) => (all.json_schema === undefined ? v : undefined) },
  logit_bias: logitBias("pairs"),
  dry_sequence_breakers: { key: "dry_sequence_breakers", to: breakerList },
};
