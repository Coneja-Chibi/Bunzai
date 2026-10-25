/**
 * The macro engine's shared types: RoleCall's engine inside
 * ADR-012. What changed from RoleCall, and why:
 *
 * - The context is value-only. No clock, randomness, filesystem, network, or database rides on it:
 *   the time is `now` (epoch ms, supplied by the caller; absent means time macros render ""), and
 *   randomness reaches a handler through its `HandlerRun`, seeded from `randomSeed`, never from
 *   ambient `Math.random`.
 * - Variable timestamps are epoch ms, not Date objects, for the same reason.
 * - The stripped features' fields are gone (visual novel, mechanics, Orison), and so are their
 *   handlers; their macros are unknown here, as pipeline-hooks.md's stripped list says.
 * - Results carry render segments with authored-source offsets, which the preset workbench's
 *   editable preview is built on (Bunraku's addition; RoleCall has no editable preview).
 */

import type { ChoiceGroup, ChoiceSelections } from "./choice-groups";

// ---- Variables --------------------------------------------------------------------------------

export interface MacroVariableArray extends Array<MacroVariableValue> {}
export interface MacroVariableObject {
  [key: string]: MacroVariableValue;
}
export type MacroVariableValue = string | number | boolean | null | MacroVariableArray | MacroVariableObject;

export interface MacroVariable {
  value: MacroVariableValue;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms. */
  updatedAt: number;
}

// ---- Context ----------------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Epoch ms. */
  timestamp?: number;
}

export interface Pronouns {
  they: string;
  them: string;
  their: string;
  theirs: string;
  themself: string;
}

/** A preset prompt as toggle-introspection macros see it ({{enabled::id}}, {{include::id}}). */
export interface PresetPromptInfo {
  id: string;
  /** Stable author-facing identifier (SillyTavern's, e.g. "main", or a custom one). */
  identifier: string;
  name: string;
  /** Effective enabled state, after per-chat overrides. */
  enabled: boolean;
  metadata?: Record<string, MacroVariableValue>;
  content?: string;
}

export interface TriggeredEntry {
  id: string;
  title: string;
  content: string;
  lorebookId: string;
  lorebookName: string;
}

export interface LorebookReference {
  id: string;
  name: string;
  entryCount: number;
}

export interface MacroContext {
  // Identity
  characterName: string;
  characterDescription?: string;
  characterPersonality?: string;
  userName: string;
  userPersona?: string;
  modelName?: string;
  groupName?: string;
  /** Namespaces `character:` scoped variables; falls back to characterName. */
  characterId?: string;

  // Card fields
  scenario?: string;
  firstMessage?: string;
  mesExamples?: string[];

  characterPronouns?: Pronouns;
  userPronouns?: Pronouns;

  // Chat
  messages: ChatMessage[];
  messageCount: number;
  /** Absolute live ordinals parallel to `messages` when the transcript holds a page. */
  messageIndices?: number[];
  /** Targeted off-page text already read for this showing. */
  messageLookup?: ReadonlyMap<number, ChatMessage>;
  /** Missing absolute ordinals discovered during this synchronous display pass. */
  missingMessageIndices?: Set<number>;
  userMessageCount?: number;
  assistantMessageCount?: number;
  lastUserMessageIndex?: number;
  lastAssistantMessageIndex?: number;
  chatId?: string;
  /** Epoch ms. */
  chatStartTime?: number;
  /** Epoch ms. */
  lastActivityTime?: number;
  chatMemories?: string[];
  chatSummary?: string;

  // Lorebooks
  triggeredEntries?: TriggeredEntry[];
  activeLorebooks?: LorebookReference[];

  // Variables
  localVariables: Map<string, MacroVariable>;
  globalVariables: Map<string, MacroVariable>;

  // The active preset
  presetPrompts?: PresetPromptInfo[];
  choiceGroups?: ChoiceGroup[];
  choiceSelections?: ChoiceSelections;

  // Per-assembly definitions
  userMacros: Map<string, string>;
  templates?: Map<string, string>;
  blockOverrides?: Map<string, string>;
  /** {{rcounter}} state; lives for one prompt build, shared by all its blocks. */
  counters?: Map<string, number>;

  // Colors
  characterAccentColor?: string;
  characterPalette?: Array<{ label: string; name: string; hex: string }>;
  characterGradient?: string[];
  personaAccentColor?: string;
  personaPalette?: Array<{ label: string; name: string; hex: string }>;
  personaGradient?: string[];

  // Group card context (Lumiverse-compatible group macros)
  groupCardMode?: string;
  focusedCharacterName?: string;
  focusedCharacterDescription?: string;
  focusedCharacterPersonality?: string;
  groupMembers?: Array<{ name: string; description?: string; personality?: string }>;

  // Mock-reasoning tags ({{reasoningPrefix}}/{{reasoningSuffix}})
  reasoningPrefix?: string;
  reasoningSuffix?: string;

  // Time: a value, never read from the system (ADR-012)
  /** Epoch ms; absent means time macros render "". */
  now?: number;
  timezone?: string;
  locale?: string;
  /** Seed for every volatile macro in one run; the same seed replays the same rolls. */
  randomSeed?: number;

  /** Side-effect macros become no-ops (historical messages); reads are unaffected. */
  readOnly?: boolean;

  /**
   * Run author regex ({{regex}}, compare's `matches`). Off unless a caller opts in: a backtracking
   * pattern hangs a browser's regex engine, and ADR-012 keeps regex under ADR-009's isolation, which
   * no caller has yet. RoleCall always runs it.
   */
  allowRegex?: boolean;
}

/** The error a regex macro records when its caller has not opted in. */
export const REGEX_OFF = "regex is off here: author patterns run only where they are isolated (ADR-009)";

// ---- Handlers ---------------------------------------------------------------------------------

export interface MacroSideEffect {
  type: "setLocalVar" | "setGlobalVar" | "deleteLocalVar" | "deleteGlobalVar";
  key: string;
  value?: MacroVariableValue;
  /** The macro that produced it; the evaluator fills it in. */
  cause?: string;
}

export interface MacroResult {
  value: string;
  success: boolean;
  error?: string;
  sideEffects?: MacroSideEffect[];
}

/** What a handler gets beyond its args and context: seeded randomness, nothing ambient. */
export interface HandlerRun {
  random(): number;
}

export type MacroHandler = (args: string[], context: MacroContext, run: HandlerRun) => MacroResult;

/**
 * An argument a lazy handler receives unevaluated: `raw` is its source text (whitespace kept,
 * macros unexpanded), `evaluate()` expands it on demand without trimming. For macros whose body
 * must not run unconditionally: iteration, conditional content, whitespace-sensitive output.
 */
export interface LazyMacroArg {
  raw: string;
  evaluate(): string;
}

export type LazyMacroHandler = (args: LazyMacroArg[], context: MacroContext, run: HandlerRun) => MacroResult;

export type MacroCategory =
  | "identity"
  | "time"
  | "random"
  | "chat"
  | "variables"
  | "conditional"
  | "text"
  | "lorebook"
  | "pronouns"
  | "preset";

export interface MacroArgDef {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

interface MacroDefinitionBase {
  /** Lowercase, except the capitalized pronoun forms ({{They}}), which stay distinct. */
  name: string;
  aliases?: string[];
  description: string;
  args?: MacroArgDef[];
  category: MacroCategory;
  hasSideEffects?: boolean;
  /** Nondeterministic (random or time): a result that used it is never cached. */
  volatile?: boolean;
  /**
   * For a macro that picks one of its options ({{random}}, {{pick}}): the options its evaluated
   * args offer, so the preview can show which one rolled and offer the others.
   */
  choices?: (args: string[]) => string[];
}

/** Every macro has one executable path; lazy handlers take precedence and need no dead eager twin. */
export type MacroDefinition = MacroDefinitionBase & (
  | { handler: MacroHandler; lazyHandler?: LazyMacroHandler }
  | { handler?: never; lazyHandler: LazyMacroHandler }
);

// ---- Results ----------------------------------------------------------------------------------

export interface MacroExpansion {
  /** The macro as written, with its args evaluated (e.g. "{{char}}"). */
  original: string;
  expanded: string;
  macroName: string;
  /** Order of expansion within the run, as RoleCall numbers it. */
  depth: number;
}

export interface MacroError {
  macro: string;
  message: string;
}

/**
 * One span of rendered output tied to the AUTHORED text it came from: `sourceStart`/`sourceEnd`
 * are offsets into the original template, so a literal edit is a plain splice of the source.
 */
export type RenderSegment = LiteralSegment | MacroSegment;

export interface LiteralSegment {
  kind: "literal";
  /** The authored source slice, verbatim: escaped braces unrestored, newline runs uncollapsed. */
  value: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface MacroSegment {
  kind: "macro";
  /** The macro's or block's resolved output. */
  value: string;
  /** The authored source slice, macro syntax and all. */
  raw: string;
  name: string;
  sourceStart: number;
  sourceEnd: number;
  /** Volatile choices, for reroll and branch editing in the preview. */
  detail?: MacroSegmentDetail;
}

export type MacroSegmentDetail =
  | { kind: "choice"; options: string[]; chosenIndex: number }
  | { kind: "branch"; taken: "then" | "else" };

export interface MacroProcessResult {
  text: string;
  segments: RenderSegment[];
  expansions: MacroExpansion[];
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  /** "local:x" / "global:y" keys read during the run, sorted. */
  touchedVariables: string[];
  /** False once a volatile macro ran or a side effect landed. */
  cacheable: boolean;
}
