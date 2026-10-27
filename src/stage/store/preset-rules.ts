/**
 * The ChatStore checks for a scene's preset pick and its sampler overrides (ChatStore
 * rule 19), split from chat-rules.ts for the file-size cap. Shared by both stores and the loadout reader.
 */
import { isPlainObject } from "../../core/guards";
import { isWhole } from "./scalar-rules";
import { checkText, fail } from "./chat-rules";
import { customTextProblem, sceneParamsProblem, type SceneGeneration } from "../params/scene";
import type { ChatPreset, ChatPresetSamplers } from "../contracts/chat-store";

/**
 * The numeric sampler fields' kind, keyed by every ChatPresetSamplers field but
 * promptPostProcessing and contextMode. A field added to or removed from ChatPresetSamplers (contracts/chat-store.ts,
 * itself Pick<PresetSamplers, ...>) fails tsc here instead of silently going unchecked (rule 19).
 */
const NUMERIC_SAMPLER_KIND: Record<Exclude<keyof ChatPresetSamplers, "promptPostProcessing" | "contextMode" | keyof SceneGeneration>, "number" | "positiveInt" | "wholeCount"> = {
  temperature: "number",
  topP: "number",
  topK: "number",
  topA: "number",
  minP: "number",
  frequencyPenalty: "number",
  presencePenalty: "number",
  repetitionPenalty: "number",
  maxTokens: "positiveInt",
  maxContext: "positiveInt",
  maxMessages: "wholeCount",
};

/**
 * Every value SillyTavern's custom_prompt_post_processing accepts (PresetSamplers,
 * entities/preset/schema.ts). Keyed by the union itself, so a member added there without a matching
 * entry here fails tsc instead of being silently accepted, or refused, wrong.
 */
const POST_PROCESSING_VALUES: Record<NonNullable<ChatPresetSamplers["promptPostProcessing"]>, true> = {
  none: true,
  merge: true,
  merge_tools: true,
  semi: true,
  semi_tools: true,
  strict: true,
  strict_tools: true,
  single: true,
  claude: true,
};

/** A scene's sampler overrides (rule 19): only the named fields, each of its type. Required, but may be empty. */
export function checkPresetSamplers(value: unknown): ChatPresetSamplers {
  if (!isPlainObject(value)) fail("preset samplers must be a plain object");
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (key === "params") {
      if (v === undefined) continue;
      const why = sceneParamsProblem(v);
      if (why) fail(`preset samplers ${why}`);
      out[key] = v;
      continue;
    }
    if (key === "customHeaders" || key === "customBody" || key === "customExclude") {
      if (v === undefined) continue;
      const why = customTextProblem(key, v);
      if (why) fail(`preset samplers ${why}`);
      out[key] = v;
      continue;
    }
    if (key === "promptPostProcessing") {
      if (v === undefined) continue;
      if (typeof v !== "string" || !Object.hasOwn(POST_PROCESSING_VALUES, v)) {
        fail(`preset samplers promptPostProcessing has an unknown value: ${JSON.stringify(v)}`);
      }
      out[key] = v;
      continue;
    }
    if (key === "contextMode") {
      if (v === undefined) continue;
      if (v !== "tokens" && v !== "messages") fail(`preset samplers contextMode must be tokens or messages: ${JSON.stringify(v)}`);
      out[key] = v;
      continue;
    }
    if (!Object.hasOwn(NUMERIC_SAMPLER_KIND, key)) fail(`preset samplers has an unknown field: ${key}`);
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) fail(`preset samplers ${key} must be a finite number`);
    const kind = NUMERIC_SAMPLER_KIND[key as keyof typeof NUMERIC_SAMPLER_KIND];
    if (kind === "positiveInt" && !isWhole(v, 1)) fail(`preset samplers ${key} must be a positive whole number`);
    if (kind === "wholeCount" && !isWhole(v, 0)) fail(`preset samplers ${key} must be a whole number, zero or more`);
    out[key] = v;
  }
  return out as ChatPresetSamplers;
}

/**
 * Exactly a writing setup's kind and id, a toggles map, and sampler overrides, or null to forget it (rule 19). The
 * toggles map is built with fromEntries, not assignment, so a "__proto__" key stays a plain own
 * property instead of silently changing the object's prototype.
 */
export function checkPreset(value: unknown): ChatPreset | null {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("preset must be a plain object or null");
  const known = new Set(["kind", "id", "toggles", "samplers"]);
  for (const key of Object.keys(value)) if (!known.has(key)) fail(`preset has an unknown field: ${key}`);
  const kind = checkText(value.kind, "preset kind");
  if (!/^[a-z]+$/.test(kind)) fail("preset kind must be a kind id");
  const id = checkText(value.id, "preset id");
  if (id.length === 0) fail("preset id must not be empty");
  if (!isPlainObject(value.toggles)) fail("preset toggles must be a plain object");
  const toggles: Record<string, boolean> = Object.fromEntries(
    Object.entries(value.toggles).map(([key, v]): [string, boolean] => {
      if (key.length === 0) fail("preset toggle key must not be empty");
      if (typeof v !== "boolean") fail(`preset toggle ${key} must be true or false`);
      return [key, v];
    }),
  );
  const samplers = checkPresetSamplers(value.samplers);
  return { kind, id, toggles, samplers };
}
