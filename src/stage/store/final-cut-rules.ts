/**
 * The input check and the merge for a scene's Final Cut, applied by every ChatStore implementation so
 * they cannot refuse or keep different things. A pass is checked field by field against the closed sets in core/final-cut: an unknown
 * field, type or choice, a number out of range or a text past its cap refuses the whole patch (nothing authored is quietly dropped), and
 * a scene holds at most one pass of each type.
 */
import { BANK_DEPTH } from "../../core/final-cut/banks";
import {
  EDITOR_DIALOGUE_POLICIES, EDITOR_NARRATION_DISTANCES, EDITOR_PARAGRAPH_DENSITIES, EDITOR_POV_MODES, EDITOR_PROFILES, EDITOR_REWRITE_STRENGTHS,
  EDITOR_TENSE_MODES, TRANSLATOR_HONORIFIC_POLICIES, TRANSLATOR_LOCALIZATION_MODES, TRANSLATOR_NAME_POLICIES, TRANSLATOR_REGISTERS, idsOf,
} from "../../core/final-cut/options";
import { MAX_CONTEXT_MESSAGES, MAX_OUTPUT_TOKENS, MAX_TEMPERATURE, PASS_TYPES, TOOL_IDS, TOOL_MAX_TOKENS, type FinalCutPass, type FinalCutSettings, type FinalCutTools } from "../../core/final-cut/pass";
import { MAX_RERUNS, readRerun, type RerunEntry } from "../../core/final-cut/trace";
import { isPlainObject } from "../../core/guards";
import type { JsonObject } from "../contracts/chat-store";
import { StudioConflictError } from "../../studio/errors";
import type { ChatFinalCut, ChatFinalCutPatch } from "../contracts/chat-final-cut-types";
import { fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";

const MAX_BYTES = 512 * 1024;
const KEYS = ["on", "passes", "tools"];

type Check = (v: unknown) => boolean;
const clean = (s: string): boolean => !s.includes("\u0000");
const text = (max: number): Check => (v) => typeof v === "string" && v.length <= max && clean(v);
const word = (max: number): Check => (v) => typeof v === "string" && v.length >= 1 && v.length <= max && clean(v);
const oneOf = (ids: readonly string[]): Check => (v) => typeof v === "string" && ids.includes(v);
const bool: Check = (v) => typeof v === "boolean";
const num = (low: number, high: number, int = false): Check => (v) => (int ? isWhole(v, low, high) : typeof v === "number" && Number.isFinite(v) && v >= low && v <= high);
const list = (items: number, each: Check): Check => (v) => Array.isArray(v) && v.length <= items && v.every(each);
const record = (entries: number, key: Check, value: Check): Check => (v) =>
  isPlainObject(v) && Object.keys(v).length <= entries && Object.entries(v).every(([k, x]) => k !== "__proto__" && key(k) && value(x));
const exact = (allowed: readonly string[], fields: Readonly<Record<string, Check>>, required: readonly string[] = []): Check => (v) =>
  isPlainObject(v) && required.every((k) => v[k] !== undefined) && Object.entries(v).every(([k, x]) => allowed.includes(k) && fields[k]!(x));
const connection: Check = exact(["id", "model"], { id: word(200), model: word(200) }, ["id", "model"]);
const orNull = (c: Check): Check => (v) => v === null || c(v);

const ENUM = {
  failureMode: oneOf(["skip", "fallback", "block"]),
  outputMode: oneOf(["tagged", "tool-call"]),
  depth: oneOf(Object.keys(BANK_DEPTH)),
};

const PASS_FIELDS: Readonly<Record<keyof FinalCutPass, Check>> = {
  id: word(64), type: oneOf(PASS_TYPES), enabled: bool, label: text(120), order: num(-100_000, 100_000), failureMode: ENUM.failureMode, outputMode: ENUM.outputMode,
  connection, contextMessages: num(1, MAX_CONTEXT_MESSAGES, true), temperature: num(0, MAX_TEMPERATURE), maxOutputTokens: num(1, MAX_OUTPUT_TOKENS, true), stripThinkingFromInput: bool, applyRegexToInput: bool,
  profileId: oneOf(idsOf(EDITOR_PROFILES)), povMode: oneOf(idsOf(EDITOR_POV_MODES)), rewriteStrength: oneOf(idsOf(EDITOR_REWRITE_STRENGTHS)), tenseMode: oneOf(idsOf(EDITOR_TENSE_MODES)),
  dialoguePolicy: oneOf(idsOf(EDITOR_DIALOGUE_POLICIES)), narrationDistance: oneOf(idsOf(EDITOR_NARRATION_DISTANCES)), paragraphDensity: oneOf(idsOf(EDITOR_PARAGRAPH_DENSITIES)),
  preserveDialogue: bool, preserveFormatting: bool, forbidNewFacts: bool, guideContent: text(20_000), attachedRules: list(50, word(200)),
  attachedSets: list(100, word(200)), enabledBanks: list(600, word(200)), defaultDepth: ENUM.depth, bankDepthOverrides: record(600, word(200), ENUM.depth),
  pinnedBankExamples: record(600, word(200), list(500, word(2_000))), customSlopisms: text(20_000), antiSlopInstructions: text(8_000),
  targetLanguage: text(80), strictness: oneOf(["loose", "balanced", "strict"]), translatorRegister: oneOf(idsOf(TRANSLATOR_REGISTERS)),
  localizationMode: oneOf(idsOf(TRANSLATOR_LOCALIZATION_MODES)), honorificPolicy: oneOf(idsOf(TRANSLATOR_HONORIFIC_POLICIES)), namePolicy: oneOf(idsOf(TRANSLATOR_NAME_POLICIES)),
  glossary: text(20_000), neverTranslateTerms: text(8_000), alwaysTranslateTerms: text(8_000), instructions: text(8_000),
  agentPrompt: text(20_000), customPresetId: orNull(word(200)), customPresetName: orNull(text(200)), customPresetPromptStates: record(200, word(200), bool),
  applyToUserMessages: bool,
};
const REQUIRED: readonly (keyof FinalCutPass)[] = ["id", "type", "order", "failureMode"];
const pass: Check = exact(Object.keys(PASS_FIELDS), PASS_FIELDS, REQUIRED);

const TOOL_FIELDS: Readonly<Record<string, Check>> = { connection, temperature: num(0, 2), maxTokens: num(1, TOOL_MAX_TOKENS, true) };
const tools: Check = (v) => isPlainObject(v) && Object.entries(v).every(([k, x]) => (TOOL_IDS as readonly string[]).includes(k) && exact(Object.keys(TOOL_FIELDS), TOOL_FIELDS)(x));

function checkPasses(value: unknown): FinalCutPass[] {
  if (!Array.isArray(value) || value.length > PASS_TYPES.length) fail(`passes must be a list of at most ${PASS_TYPES.length}, one for each type`);
  for (const p of value) if (!pass(p)) fail("a pass has an unknown or malformed field, or lacks its id, type, order or failure mode");
  if (new Set(value.map((p: FinalCutPass) => p.type)).size !== value.length) fail("a scene holds at most one pass of each type");
  return structuredClone(value) as FinalCutPass[];
}

/** A re-run entry for a reply's run (rule 46), checked once; the reply keeps at most MAX_RERUNS. */
export function checkRerun(value: unknown): RerunEntry {
  const entry = readRerun(value);
  if (!entry) fail("a re-run needs its time, its length, the text before and after, and what each pass did");
  if (entry.before.length + entry.after.length > 400_000) fail("a re-run keeps at most 400,000 characters of text");
  return structuredClone(entry);
}

/** The trace with a checked re-run added to its Final Cut run, or null when the trace holds no run. A full list is refused, never trimmed. */
export function traceWithRerun(trace: JsonObject, entry: RerunEntry): JsonObject | null {
  const run = trace["finalCut"];
  if (!isPlainObject(run)) return null;
  const reruns = Array.isArray(run["reruns"]) ? run["reruns"] : [];
  if (reruns.length >= MAX_RERUNS) throw new StudioConflictError(`this reply keeps at most ${MAX_RERUNS} re-runs`);
  return { ...trace, finalCut: { ...run, reruns: [...reruns, entry] } } as JsonObject;
}

/** A patch whose keys are `on` (true, false or null), `passes` (a checked list or null) and `tools` (a checked object or null). An empty patch is allowed and changes nothing. */
export function checkFinalCut(value: unknown): ChatFinalCutPatch {
  if (!isPlainObject(value)) fail("finalCut must be a plain object");
  for (const key of Object.keys(value)) if (!KEYS.includes(key)) fail(`finalCut has an unknown field: ${key}`);
  if (value.on !== undefined && value.on !== null && !bool(value.on)) fail("on must be true, false or null");
  if (value.tools !== undefined && value.tools !== null && !tools(value.tools)) fail("tools must name only rewrite, expand, reduce or correct, each with a connection, a temperature of 0 to 2 and a token limit of 1 to 8000");
  return {
    ...(value.on === undefined ? {} : { on: value.on as boolean | null }),
    ...(value.passes === undefined ? {} : { passes: value.passes === null ? null : checkPasses(value.passes) }),
    ...(value.tools === undefined ? {} : { tools: value.tools === null ? null : (structuredClone(value.tools) as FinalCutTools) }),
  };
}

/** The scene's Final Cut after a checked patch; null when nothing is left to keep. */
export function mergeFinalCut(old: ChatFinalCut | undefined, patch: ChatFinalCutPatch): ChatFinalCut | null {
  const pick = <K extends keyof FinalCutSettings>(key: K): FinalCutSettings[K] | undefined => (patch[key] === undefined ? old?.[key] : (patch[key] ?? undefined)) as FinalCutSettings[K] | undefined;
  const on = pick("on");
  const passes = pick("passes");
  const toolsNext = pick("tools");
  const out: ChatFinalCut = {
    ...(on ? { on: true } : {}),
    ...(passes && passes.length > 0 ? { passes } : {}),
    ...(toolsNext && Object.keys(toolsNext).length > 0 ? { tools: toolsNext } : {}),
  };
  if (JSON.stringify(out).length > MAX_BYTES) fail(`Final Cut must hold at most ${MAX_BYTES / 1024} KB`);
  return Object.keys(out).length > 0 ? out : null;
}
