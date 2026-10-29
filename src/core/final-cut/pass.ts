/**
 * One Final Cut pass as a scene stores it, and the defaults a pass starts from (RoleCall's PostGenActionConfig and createDefaultPostGenAction,
 * rc lib/post-gen-actions/types.ts:50-175 and profiles.ts:349-501). A flat record with the fields of its own type; the five types are
 * singletons, so a scene holds at most one of each. RoleCall's pre-2026.05 anti-slop fields are not carried (Bunzai has no old data), a
 * model is a Kit connection and model (`connection`, as the Compendium's) where RoleCall keeps a provider id and a model id, and a pass
 * turned Off keeps its settings (`enabled: false`) where RoleCall removes them.
 */
import type {
  EditorDialoguePolicy, EditorNarrationDistance, EditorParagraphDensity, EditorPovMode, EditorProfileId, EditorRewriteStrength,
  EditorTenseMode, TranslatorHonorificPolicy, TranslatorLocalizationMode, TranslatorNamePolicy, TranslatorRegister,
} from "./options";
import type { BankDepth } from "./banks";

export type PassType = "editor" | "anti-slop" | "translator" | "validator" | "custom-agent";
export type FailureMode = "skip" | "fallback" | "block";
export type OutputMode = "tagged" | "tool-call";
export type Strictness = "loose" | "balanced" | "strict";

export const PASS_TYPES: readonly PassType[] = ["validator", "anti-slop", "editor", "translator", "custom-agent"];

export interface FinalCutPass {
  id: string;
  type: PassType;
  /** A pass switched Off keeps everything it was set to. Absent means on. */
  enabled?: boolean;
  label?: string;
  order: number;
  failureMode: FailureMode;
  /** How the model returns its result; absent means tool-call. */
  outputMode?: OutputMode;
  /** The Kit connection and model this pass runs on; absent means the scene's own. */
  connection?: { id: string; model: string };
  /** Recent messages the pass sees as context, 1 to 10 (default 3). */
  contextMessages?: number;
  /** 0 to 1.5; absent means the pass type's own (anti-slop 0.15, translator 0.2, else 0.35). */
  temperature?: number;
  /** 1 to 64000 reply tokens; absent means the larger of 16000 and a third of the input, capped. */
  maxOutputTokens?: number;
  /** Cut `<think>` blocks from the pass's input first. Absent means yes. */
  stripThinkingFromInput?: boolean;
  /** Run the scene's AI-output regex (its text-rewriting display rules, in the page's sandbox) on the pass's input first. Absent means yes. */
  applyRegexToInput?: boolean;
  // Editor
  profileId?: EditorProfileId;
  povMode?: EditorPovMode;
  rewriteStrength?: EditorRewriteStrength;
  tenseMode?: EditorTenseMode;
  dialoguePolicy?: EditorDialoguePolicy;
  narrationDistance?: EditorNarrationDistance;
  paragraphDensity?: EditorParagraphDensity;
  preserveDialogue?: boolean;
  preserveFormatting?: boolean;
  forbidNewFacts?: boolean;
  /** House style and scene rules, free text. */
  guideContent?: string;
  /** Craft-floor rule ids (the catalog's `rules/...`). */
  attachedRules?: string[];
  // Anti-Slop
  attachedSets?: string[];
  enabledBanks?: string[];
  defaultDepth?: BankDepth;
  bankDepthOverrides?: Record<string, BankDepth>;
  /** Catalog entries pinned to always be sent, by bank id. Checked against the catalog when the prompt is built. */
  pinnedBankExamples?: Record<string, string[]>;
  customSlopisms?: string;
  antiSlopInstructions?: string;
  // Translator
  targetLanguage?: string;
  strictness?: Strictness;
  translatorRegister?: TranslatorRegister;
  localizationMode?: TranslatorLocalizationMode;
  honorificPolicy?: TranslatorHonorificPolicy;
  namePolicy?: TranslatorNamePolicy;
  glossary?: string;
  neverTranslateTerms?: string;
  alwaysTranslateTerms?: string;
  /** Localization notes (translator) or extra instructions. */
  instructions?: string;
  // Custom agent
  agentPrompt?: string;
  customPresetId?: string | null;
  customPresetName?: string | null;
  customPresetPromptStates?: Record<string, boolean>;
  // Validator
  applyToUserMessages?: boolean;
}

/** What a scene keeps of Final Cut (ChatStore rule 44). */
export interface FinalCutSettings {
  /** The master switch; absent means off. */
  on?: boolean;
  passes?: FinalCutPass[];
  /** Per-tool model and parameters for the on-demand editing tools. */
  tools?: FinalCutTools;
}

export type ToolId = "rewrite" | "expand" | "reduce" | "custom" | "correct";
export const TOOL_IDS: readonly ToolId[] = ["rewrite", "expand", "reduce", "custom", "correct"];
/** The one label each tool wears wherever it is listed (the Final Cut tools card and the Rewrite tab's buttons). */
export const TOOL_LABELS: Readonly<Record<ToolId, string>> = { rewrite: "Rewrite", expand: "Expand", reduce: "Reduce", custom: "Custom", correct: "Correction" };
export interface ToolConfig {
  connection?: { id: string; model: string };
  temperature?: number;
  maxTokens?: number;
}
export type FinalCutTools = Partial<Record<ToolId, ToolConfig>>;

export const DEFAULT_CONTEXT_MESSAGES = 3;
export const MAX_CONTEXT_MESSAGES = 10;
export const MAX_OUTPUT_TOKENS = 64_000;
export const MAX_TEMPERATURE = 1.5;
export const TOOL_MAX_TOKENS = 8_000;

/** The default temperature of a pass type when the person set none. */
export const defaultTemperature = (type: PassType): number => (type === "translator" ? 0.2 : type === "anti-slop" ? 0.15 : 0.35);

const clamp = (n: unknown, low: number, high: number, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
export const contextMessagesOf = (n: unknown): number => Math.floor(clamp(n, 1, MAX_CONTEXT_MESSAGES, DEFAULT_CONTEXT_MESSAGES));
export const temperatureOf = (n: unknown, type: PassType): number => clamp(n, 0, MAX_TEMPERATURE, defaultTemperature(type));

const IDS: Readonly<Record<PassType, { id: string; label: string }>> = {
  validator: { id: "post-validator", label: "Output Safety Check" },
  "anti-slop": { id: "post-anti-slop", label: "Anti-Slop Engine" },
  editor: { id: "post-editor", label: "Editor" },
  translator: { id: "post-translator", label: "Translator" },
  "custom-agent": { id: "post-custom-agent", label: "Custom Agent" },
};

/** A pass of this type with RoleCall's defaults, at position `index` (order = 10 x index). */
export function createPass(type: PassType, index = 0): FinalCutPass {
  const base = { ...IDS[type], type, order: index * 10 };
  switch (type) {
    case "validator":
      return { ...base, failureMode: "fallback", applyToUserMessages: false };
    case "anti-slop":
      return {
        ...base, failureMode: "skip", outputMode: "tool-call", contextMessages: 3,
        attachedSets: ["wordbank", "universal-tells"],
        enabledBanks: ["wordbank/canonical-ai-tells", "wordbank/essay-register", "wordbank/wb-metaphors", "wordbank/filter-words", "phrase/named-prose-bans", "lexical/auth-hedges"],
        defaultDepth: "standard", bankDepthOverrides: {}, pinnedBankExamples: {}, customSlopisms: "", antiSlopInstructions: "",
      };
    case "translator":
      return {
        ...base, failureMode: "fallback", outputMode: "tool-call", contextMessages: 3, targetLanguage: "English", strictness: "balanced",
        translatorRegister: "neutral", localizationMode: "natural", honorificPolicy: "preserve", namePolicy: "preserve",
      };
    case "custom-agent":
      return {
        ...base, failureMode: "fallback", outputMode: "tool-call", contextMessages: 3,
        agentPrompt: "Review the reply and improve it according to the user's custom post-generation instructions.",
      };
    case "editor":
      return {
        ...base, failureMode: "fallback", outputMode: "tool-call", contextMessages: 3, profileId: "voicekeeper", povMode: "preserve",
        rewriteStrength: "light", tenseMode: "preserve", dialoguePolicy: "preserve", narrationDistance: "preserve", paragraphDensity: "preserve",
        preserveDialogue: true, preserveFormatting: true, forbidNewFacts: true,
      };
  }
}

/** The passes that will run, in order: the enabled ones, each with its defaults under what was set. */
export function activePasses(passes: readonly FinalCutPass[] | undefined): FinalCutPass[] {
  return (passes ?? [])
    .filter((p) => p.enabled !== false)
    .map((p, i) => ({ ...createPass(p.type, i), ...p }))
    .sort((a, b) => a.order - b.order);
}

/** The pass of a type, on or off, or undefined. */
export const passOf = (passes: readonly FinalCutPass[] | undefined, type: PassType): FinalCutPass | undefined => passes?.find((p) => p.type === type);
