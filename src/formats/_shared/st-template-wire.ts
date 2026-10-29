/**
 * SillyTavern's non-chat-completion preset files that DO have a home in a Bunzai preset: the
 * KoboldAI / TextGen / NovelAI sampler sets (their samplers land on the preset's samplers) and the
 * system prompt template (its text lands as the preset's main block), and the reasoning template (its
 * prefix, suffix and separator land as the preset's reasoning). Everything else in those files
 * (typical_p, tfs, mirostat, DRY, sampler order, and the instruct/context templates a TextGen file
 * may bundle) rides sealed in the raw twin, because Bunzai sends none of it. Instruct and context
 * templates are NOT handled here: they are the prompt-format piece (promptformat.ts).
 * Pure: raw JSON in, canonical pieces out, and the inverse for export.
 */
import type { PresetBody, PresetPrompt, PresetReasoning, PresetSamplers } from "../../entities/preset/schema";
import { samplerSchema } from "../../entities/preset/runtime-schema";
import { isRecord, optStr, type Rec } from "../../core/guards";
import { writeGroup } from "./st-preset-emit";
import { DEFAULT_MARKER_IDENTIFIERS, mapGroup } from "./st-preset-wire";

export type TemplateShape = "kobold" | "textgen" | "novelai" | "sysprompt" | "master" | "reasoning";

/** [wireKey, canonicalKey] per sampler dialect; same convention as SAMPLER_FIELDS. */
const FIELDS: Partial<Record<TemplateShape, ReadonlyArray<readonly [string, string]>>> = {
  kobold: [["temp", "temperature"], ["top_p", "topP"], ["top_k", "topK"], ["top_a", "topA"], ["min_p", "minP"], ["rep_pen", "repetitionPenalty"]],
  textgen: [
    ["temp", "temperature"], ["top_p", "topP"], ["top_k", "topK"], ["top_a", "topA"], ["min_p", "minP"],
    ["rep_pen", "repetitionPenalty"], ["freq_pen", "frequencyPenalty"], ["presence_pen", "presencePenalty"],
    ["genamt", "maxTokens"], ["max_length", "maxContext"],
  ],
  // NovelAI's repetition_penalty (up to 3+), frequency and presence terms are on NovelAI's own scale;
  // sent as the OpenAI-style fields they would wreck a normal model, so they stay sealed in the twin.
  novelai: [
    ["temperature", "temperature"], ["top_p", "topP"], ["top_k", "topK"], ["top_a", "topA"], ["min_p", "minP"],
    ["max_context", "maxContext"],
  ],
};

/** Appended to the name of a template that is not a sampler set, so a bare "DeepSeek" says what it is. */
export const SHAPE_SUFFIX: Record<TemplateShape, string> = {
  kobold: "", textgen: "", novelai: "", sysprompt: " (system prompt)", master: "", reasoning: " (reasoning)",
};

export const toTemplateShape = (v: unknown): TemplateShape | undefined =>
  v === "kobold" || v === "textgen" || v === "novelai" || v === "sysprompt" || v === "master" || v === "reasoning" ? v : undefined;

/** The sampler dialect a shape is, or undefined when it is not a sampler set. */
export const samplerSetOf = (shape: TemplateShape): "kobold" | "textgen" | "novelai" | undefined =>
  shape === "kobold" || shape === "textgen" || shape === "novelai" ? shape : undefined;

const SYSPROMPT_KEYS = new Set(["name", "content", "post_history"]);
const REASONING_KEYS = new Set(["name", "prefix", "suffix", "separator"]);
const TEXTGEN_KEYS = ["typical_p", "freq_pen", "presence_pen", "do_sample", "temperature_last", "mirostat_mode"];
const KOBOLD_KEYS = ["typical", "tfs", "sampler_order", "mirostat"];
const hasSysprompt = (o: Rec): boolean => isRecord(o.sysprompt) && typeof o.sysprompt.content === "string";

/**
 * Which of these shapes a JSON object is, or null. Fail closed: a chat-completion preset (it has a
 * prompts array), an envelope, and anything that merely borrows one key are all refused.
 */
export function detectTemplateShape(json: unknown): TemplateShape | null {
  if (!isRecord(json) || typeof json.type === "string") return null;
  if (Array.isArray(json.prompts) || Array.isArray(json.prompt_order)) return null;
  if (typeof json.prefix === "string" && typeof json.suffix === "string" && Object.keys(json).every((k) => REASONING_KEYS.has(k))) return "reasoning";
  if (typeof json.content === "string" && Object.keys(json).every((k) => SYSPROMPT_KEYS.has(k))) return "sysprompt";
  if (Array.isArray(json.order) && "temperature" in json && ("repetition_penalty" in json || "tail_free_sampling" in json)) return "novelai";
  if ("temp" in json && TEXTGEN_KEYS.some((k) => k in json)) return "textgen";
  if ("temp" in json && "rep_pen" in json && KOBOLD_KEYS.some((k) => k in json)) return "kobold";
  return hasSysprompt(json) ? "master" : null;
}

/**
 * ST's stock prompt order (default/content/presets/openai/Default.json, global order, minus its two
 * switched-off rows). Without the card, persona and lore rows a preset sends no character at all,
 * because the assembler only fills slots a preset already has.
 */
const STOCK_ROWS = [
  ["main", "Main Prompt", false], ["worldInfoBefore", "World Info (before)", true],
  ["personaDescription", "Persona Description", true], ["charDescription", "Char Description", true],
  ["charPersonality", "Char Personality", true], ["scenario", "Scenario", true],
  ["worldInfoAfter", "World Info (after)", true], ["dialogueExamples", "Chat Examples", true],
  ["chatHistory", "Chat History", true], ["jailbreak", "Post-History Instructions", false],
] as const;
const SYSTEM_IDS: readonly string[] = STOCK_ROWS.map(([id]) => id);

const block = (id: string, name: string, content: string, marker: boolean): PresetPrompt => ({
  id, name, content, role: "system", enabled: true, systemPrompt: true, marker,
  ...(marker && DEFAULT_MARKER_IDENTIFIERS.has(id) ? { markerSlot: id } : {}),
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, isDefault: true,
});

/** The system prompt object a file carries: the file itself, or a bundled `sysprompt`. */
const systemPromptOf = (shape: TemplateShape, raw: Rec): Rec | undefined =>
  shape === "sysprompt" ? raw : hasSysprompt(raw) ? (raw.sysprompt as Rec) : undefined;

export interface ParsedTemplate {
  prompts: PresetPrompt[];
  samplers?: PresetSamplers;
  samplerSet?: "kobold" | "textgen" | "novelai";
  reasoning?: PresetReasoning;
}

/**
 * Every shape lands on ST's stock prompt order, so a scene that picks the preset still sends the
 * card; only a system prompt fills the main (and post-history) text.
 */
export function parseTemplate(shape: TemplateShape, raw: Rec): ParsedTemplate {
  const sys = systemPromptOf(shape, raw);
  const text: Record<string, string> = { main: optStr(sys?.content) ?? "", jailbreak: optStr(sys?.post_history) ?? "" };
  const fields = FIELDS[shape];
  return {
    prompts: STOCK_ROWS.map(([id, name, marker]) => block(id, name, text[id] ?? "", marker)),
    samplers: fields ? mapGroup<PresetSamplers>(raw, fields, samplerSchema) : undefined,
    samplerSet: samplerSetOf(shape),
    reasoning: shape === "reasoning" ? { prefix: optStr(raw.prefix) ?? "", suffix: optStr(raw.suffix) ?? "", separator: optStr(raw.separator) ?? "" } : undefined,
  };
}

export const templateToBody = (name: string, parsed: ParsedTemplate): PresetBody => ({
  name,
  prompts: parsed.prompts,
  ...(parsed.samplers ? { samplers: parsed.samplers } : {}),
  ...(parsed.samplerSet ? { samplerSet: parsed.samplerSet } : {}),
  ...(parsed.reasoning ? { reasoning: parsed.reasoning } : {}),
});

/** Body groups beyond samplers and prompts: a file in one of these shapes has nowhere to write them. */
const OTHER_GROUPS = ["systemPrompts", "templates", "behavior", "apiOptions", "media", "generation", "groups", "choices", "behaviorRefs", "quickReplyRefs"] as const;

/**
 * The source file's own shape with canonical's edits written over it, or null when the preset holds
 * anything the file cannot (blocks, other settings groups, samplers its dialect has no key for); the
 * caller then writes the chat-completion shape instead of dropping them.
 */
export function emitTemplate(shape: TemplateShape, twin: Rec, body: PresetBody): Rec | null {
  const sysTwin = systemPromptOf(shape, twin);
  if (!body.prompts.every((p) => SYSTEM_IDS.includes(p.id) && (sysTwin !== undefined || p.content === ""))) return null;
  const canon = new Set(FIELDS[shape]?.map(([, c]) => c));
  if (Object.keys(body.samplers ?? {}).some((k) => !canon.has(k))) return null;
  const foreign = shape === "reasoning" ? OTHER_GROUPS : [...OTHER_GROUPS, "reasoning" as const];
  if (foreign.some((g) => body[g] !== undefined && Object.keys(body[g]!).length > 0)) return null;
  const out: Rec = { ...twin };
  if (shape === "reasoning") Object.assign(out, body.reasoning ?? {});
  const fields = FIELDS[shape];
  if (fields) writeGroup(out, body.samplers as Rec | undefined, fields);
  if (sysTwin) {
    const sys: Rec = shape === "sysprompt" ? out : { ...sysTwin };
    sys.content = body.prompts.find((p) => p.id === "main")?.content ?? "";
    const post = body.prompts.find((p) => p.id === "jailbreak")?.content ?? "";
    if (post !== "" || "post_history" in sysTwin) sys.post_history = post;
    if (shape !== "sysprompt") out.sysprompt = sys;
  }
  return out;
}
