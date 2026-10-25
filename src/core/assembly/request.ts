/**
 * What a preset changes about the request once the prompt is built (RoleCall's worker at the pin):
 * its samplers and post-processing mode as provider options, its window and reply cap, and its
 * assistant prefill. Pure. The transport applies the post-processing and drops no-op samplers
 * (src/stage/provider/transport-core.ts), as RoleCall's buildRequestBody does.
 */
import type { PresetBody, PresetSamplers } from "../../entities/preset/schema";
import type { ChatPrompting } from "../../stage/contracts/chat-store";
import type { ProviderOptions, RolePostProcessing } from "../../stage/contracts/provider";
import type { SceneGeneration } from "../../stage/params/scene";
import { enabledValues } from "../../stage/params/scene";
import { claudeVersion } from "../tokens/model-family";
import { DEFAULT_MAX_TOKENS } from "./conversation";
import type { AssembledMessage, Window } from "./types";

/**
 * SillyTavern's `_tools` modes differ from their plain twins only in keeping tool definitions, and a
 * scene sends none, so they run as the plain mode. RoleCall knows no `claude` mode and sends as-is.
 */
const POST_PROCESSING: Readonly<Record<NonNullable<PresetSamplers["promptPostProcessing"]>, RolePostProcessing>> = {
  none: "none",
  merge: "merge",
  merge_tools: "merge",
  semi: "semi",
  semi_tools: "semi",
  strict: "strict",
  strict_tools: "strict",
  single: "single",
  claude: "none",
};

/**
 * The preset's samplers as provider options; a sampler the preset leaves unset stays unset. The scene's
 * own generation parameters ride along: a parameter it switched on is sent, and one it switched off
 * takes the preset's typed value out of the request too.
 */
export function presetOptions(preset: PresetBody | undefined, scene: SceneGeneration = {}): ProviderOptions {
  const s = preset?.samplers ?? {};
  const out: ProviderOptions = {};
  if (s.temperature !== undefined) out.temperature = s.temperature;
  if (s.topP !== undefined) out.top_p = s.topP;
  if (s.topK !== undefined) out.top_k = s.topK;
  if (s.topA !== undefined) out.top_a = s.topA;
  if (s.minP !== undefined) out.min_p = s.minP;
  if (s.frequencyPenalty !== undefined) out.frequency_penalty = s.frequencyPenalty;
  if (s.presencePenalty !== undefined) out.presence_penalty = s.presencePenalty;
  if (s.repetitionPenalty !== undefined) out.repetition_penalty = s.repetitionPenalty;
  if (s.promptPostProcessing) out.prompt_post_processing = POST_PROCESSING[s.promptPostProcessing];
  for (const id of Object.keys(scene.params ?? {})) if (id in out) delete (out as Record<string, unknown>)[id];
  const values = enabledValues(scene.params);
  if (Object.keys(values).length > 0) out.params = values;
  if (scene.customHeaders?.trim()) out.custom_include_headers = scene.customHeaders;
  if (scene.customBody?.trim()) out.custom_include_body = scene.customBody;
  if (scene.customExclude?.trim()) out.custom_exclude_body = scene.customExclude;
  return out;
}

/**
 * The request's options for a scene: the preset's and the scene's own parameters, and the scene's Reasoning Effort (Auto sends
 * none). A level other than None also turns Enable Thinking on for the parameters that hang from it (Clear Thinking), so the
 * one Reasoning control is the one switch, as RoleCall's "one Reasoning control" decision has it.
 */
export function sceneOptions(preset: PresetBody | undefined, scene: SceneGeneration, prompting: ChatPrompting | undefined): ProviderOptions {
  const base = presetOptions(preset, scene);
  const level = prompting?.reasoningEffort;
  if (!level) return base;
  return { ...base, reasoning_effort: level, ...(level === "none" ? {} : { params: { ...base.params, enable_thinking: true } }) };
}

/** RoleCall's window when a model states none (context-budget-resolver.ts at the pin). */
const FALLBACK_CONTEXT = 32_768;
const CONTEXT_FLOOR = 16_384;
const CONTEXT_CEILING = 200_000;

/**
 * The window a turn fits into (turn-loop item 7), RoleCall's resolver for a key the person owns:
 * the model's stated window, else 32,768; at most 200,000. Two deviations keep a small model safe:
 * the 16,384 floor applies only to the fallback, never below a window the model states, and the
 * reply reserve (RoleCall's 8,192) is at most half the window, so a small model still gets history.
 */
export function turnWindow(stated: number | undefined): Window & { stated: boolean } {
  const known = typeof stated === "number" && Number.isFinite(stated) && stated > 0;
  const context = known ? Math.min(stated, CONTEXT_CEILING) : Math.max(FALLBACK_CONTEXT, CONTEXT_FLOOR);
  return { context, reply: Math.min(DEFAULT_MAX_TOKENS, Math.floor(context / 2)), stated: known };
}

const positive = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * The turn's window with the preset applied. RoleCall lets a preset's context size override the
 * model's; a SillyTavern import often says 2,000,000 or a size the model does not have, so here the
 * preset may shrink the window, never grow it past what the model states (a named deviation). The
 * reply cap is the preset's when set, and still at most half the window, as without a preset.
 */
export function presetWindow(base: Window & { stated: boolean }, preset: PresetBody | undefined): Window {
  const asked = preset?.samplers?.maxContext;
  const context = positive(asked) && (!base.stated || asked < base.context) ? Math.min(asked, base.context) : base.context;
  const cap = preset?.samplers?.maxTokens;
  return { context, reply: Math.min(positive(cap) ? cap : DEFAULT_MAX_TOKENS, Math.floor(context / 2)) };
}

/**
 * Claude 4.6 and newer, and deepseek-reasoner, refuse a request that ends in an assistant message
 * (RoleCall's modelSupportsPrefill). Model ids come as `claude-opus-4.6` or `anthropic/claude-opus-4-6`;
 * a date suffix is not a minor version.
 */
export function modelTakesPrefill(model: string): boolean {
  const id = model.trim().toLowerCase();
  if (id.includes("deepseek-reasoner")) return false;
  const version = claudeVersion(id);
  if (!version) return true;
  return !(version.major > 4 || (version.major === 4 && version.minor >= 6));
}

/**
 * The preset's assistant prefill at the end of the request: merged into a trailing assistant message,
 * else its own assistant message; skipped when empty or when the model refuses a prefill. The reply
 * is stored as the model sent it, without the prefill, as RoleCall does.
 */
export function withPrefill(messages: readonly AssembledMessage[], prefill: string | undefined, model: string, role: "assistant" | "user" | "system" = "assistant"): AssembledMessage[] {
  const out = messages.map((m) => ({ ...m }));
  if (!prefill?.trim()) return out;
  // A user hint or system note is an ordinary turn, not an assistant continuation, so any model takes it.
  if (role !== "assistant") return [...out, { role, content: prefill }];
  if (!modelTakesPrefill(model)) return out;
  const last = out.at(-1);
  if (last?.role === "assistant") last.content = `${last.content}\n\n${prefill}`;
  else out.push({ role: "assistant", content: prefill });
  return out;
}

/**
 * Last Message as User (RoleCall's forceLastMessageToUser, lib/ai/final-message-role.ts): for models that
 * reject an assistant prefill, the request's final message is re-tagged as a user turn when it is not one.
 */
export function lastAsUser(messages: readonly AssembledMessage[]): AssembledMessage[] {
  const last = messages.at(-1);
  return last && last.role !== "user" ? [...messages.slice(0, -1), { ...last, role: "user" }] : [...messages];
}
