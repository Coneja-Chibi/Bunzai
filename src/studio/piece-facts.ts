/**
 * The pure piece-fact functions a shelf row or peek view computes from a piece's own body: rough
 * token estimate, filled card fields, a preset's carried sampler/block facts, a regex set's "does
 * what" line, and lore/persona shelf meta (search keys, entry count, brief, pronouns, section
 * count, lorebook presence). Moved out of src/ui so
 * content-store can compute the same facts into a sealed summary at write time (step 3.2), without
 * the store ever importing UI code. No src/ui imports here, ever.
 */
import { isRecord, presentNum } from "../core/guards";
import { explainPattern, slowRuleCount } from "../core/regex";
import type { PieceSummaryContent, RegexShelfFacts } from "../stage/contracts/content-store-summary";
import type { LorebookBody } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { RegexRule, RegexSetBody } from "../entities/regex/schema";

// -- character/preset peek facts (from ui/apps/library/piece-peek.ts) ---------------------------

/** Count the characters of every written string on the body (depth-bounded); roughTokenCount turns it into tokens. An inline `data:` picture is media, not written text, so it counts for nothing. */
export function writtenChars(v: unknown, depth = 0): number {
  if (depth > 6) return 0;
  if (typeof v === "string") return v.startsWith("data:") ? 0 : v.length;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + writtenChars(x, depth + 1), 0);
  if (isRecord(v)) return Object.values(v).reduce<number>((n, x) => n + writtenChars(x, depth + 1), 0);
  return 0;
}

/** The nine card fields a character card lives or dies by; "n/9" for the shelf meta line. */
export function filledCardFields(body: Record<string, unknown>): string {
  const identity = isRecord(body.identity) ? body.identity : {};
  const persona = isRecord(body.persona) ? body.persona : {};
  const prompts = isRecord(body.prompts) ? body.prompts : {};
  const greetings = isRecord(body.greetings) ? body.greetings : {};
  const examples = isRecord(body.examples) ? body.examples : {};
  const has = (v: unknown): boolean =>
    typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
  const nine = [
    identity.name,
    identity.description,
    persona.personality,
    persona.scenario,
    greetings.firstMessage,
    greetings.alternateGreetings,
    examples.exampleMessages,
    prompts.systemPrompt,
    prompts.postHistoryInstructions,
  ];
  return `${nine.filter(has).length}/9`;
}

/** What a preset card's stat strip may say: only values the preset itself carries. */
export type PresetFacts = {
  samplers?: { temperature?: number; topP?: number; topK?: number };
  blocks?: number;
  /** The SillyTavern sampler dialect, when the preset is an imported sampler set. */
  samplerSet?: "kobold" | "textgen" | "novelai";
};

/**
 * What a preset card's stat strip may say. Only values the preset CARRIES: a sampler left unset
 * is filled in by the engine at build time, and printing that default here would claim the preset
 * says something it does not.
 */
export function presetFacts(body: Record<string, unknown>): PresetFacts {
  const s = isRecord(body.samplers) ? body.samplers : {};
  const samplers = {
    temperature: presentNum(s.temperature),
    topP: presentNum(s.topP),
    topK: presentNum(s.topK),
  };
  const present = Object.fromEntries(Object.entries(samplers).filter(([, v]) => v !== undefined));
  return {
    ...(Object.keys(present).length > 0 ? { samplers: present } : {}),
    ...(Array.isArray(body.prompts) ? { blocks: body.prompts.length } : {}),
    ...(body.samplerSet === "kobold" || body.samplerSet === "textgen" || body.samplerSet === "novelai" ? { samplerSet: body.samplerSet } : {}),
  };
}

/** Which halves of a prompt format a piece holds, for its card line. */
export function promptFormatParts(body: Record<string, unknown>): ("instruct" | "context")[] {
  return (["instruct", "context"] as const).filter((half) => isRecord(body[half]));
}

// -- regex-set facts (from ui/apps/library/regex-shelf-ops.ts) -----------------------------------

/** A rule's own plain-language label, or a short honest read of its pattern when unlabeled. */
const ruleLabel = (r: RegexRule): string => {
  const label = r.label?.trim();
  if (label) return label;
  const ex = explainPattern(r.find, r.flags);
  if (ex.phrases.length > 0) return `match ${ex.phrases.slice(0, 3).join("/")}`;
  return "";
};

/**
 * The set's computed "does what" line (engine truth, no model call): the set's own description if
 * it has one, else a join of the first few rule labels ("Fix ellipsis, Curl quotes +4 more"),
 * else an honest empty state.
 */
export function doesWhatForSet(body: RegexSetBody): string {
  const desc = body.description?.trim();
  if (desc) return desc;
  const rules = body.rules ?? [];
  if (rules.length === 0) return "No rules yet.";
  const labels = rules.map(ruleLabel).filter((l) => l.length > 0);
  if (labels.length === 0) {
    return `${rules.length} ${rules.length === 1 ? "rule" : "rules"}, unnamed.`;
  }
  const shown = labels.slice(0, 3);
  const extra = labels.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}

// -- lore shelf facts (from ui/apps/library/lore-shelf-ops.ts:20-45) -----------------------------

export type LoreFacts = { entryCount: number; searchKeys: string[] };

/** A book's entry count and every trigger keyword across its entries, flattened for search. */
export function loreFacts(body: LorebookBody): LoreFacts {
  const entries = body.entries ?? [];
  const searchKeys = entries.flatMap((e) => e.triggers.map((t) => t.keyword).filter(Boolean));
  return {
    entryCount: Array.isArray(body.entries) ? body.entries.length : 0,
    searchKeys,
  };
}

// -- persona shelf facts (from ui/apps/library/persona-shelf-ops.ts:20-45) -----------------------

export type PersonaFacts = {
  brief?: string;
  /** the one-line tagline and the picked icon, for the Casting Call's tiles */
  tagline?: string;
  emoji?: string;
  pronouns?: string;
  sectionCount: number;
  hasLorebook: boolean;
};

/** A persona's card facts: brief, display pronouns, filled section count, lorebook presence. */
export function personaFacts(body: PersonaBody): PersonaFacts {
  const pronouns =
    body.identity?.pronouns ??
    (body.identity?.pronounSet
      ? `${body.identity.pronounSet.subjective}/${body.identity.pronounSet.objective}`
      : undefined);
  return {
    brief: body.brief?.trim() || undefined,
    tagline: body.identity?.tagline?.trim() || undefined,
    emoji: body.presentation?.emoji || undefined,
    pronouns,
    sectionCount: Object.values(body.sections ?? {}).filter(
      (s) => typeof s === "string" && s.trim() !== "",
    ).length,
    hasLorebook: (body.knowledgeRefs ?? []).length > 0,
  };
}

// -- the per-kind facts table ---------------------------------------------------------------------

/** A regex set's shelf facts. */
function regexFacts(body: RegexSetBody): RegexShelfFacts {
  const rules: readonly RegexRule[] = Array.isArray(body.rules) ? body.rules : [];
  return {
    enabled: body.enabled !== false,
    ruleCount: rules.length,
    enabledRuleCount: rules.filter((r) => r.enabled !== false).length,
    doesWhat: doesWhatForSet(body),
    slowCount: slowRuleCount(body),
  };
}

/** The facts only one kind has. */
export type KindFacts = Pick<PieceSummaryContent, "filled" | "samplers" | "blocks" | "samplerSet" | "formatParts" | "regex" | "lore" | "persona">;

const KIND_FACTS: Record<string, (body: Record<string, unknown>) => KindFacts> = {
  character: (b) => ({ filled: filledCardFields(b) }),
  preset: presetFacts,
  promptformat: (b) => ({ formatParts: promptFormatParts(b) }),
  regex: (b) => ({ regex: regexFacts(b as unknown as RegexSetBody) }),
  lorebook: (b) => ({ lore: { enabled: b.enabled !== false, ...loreFacts(b as unknown as LorebookBody) } }),
  persona: (b) => ({ persona: personaFacts(b as unknown as PersonaBody) }),
};

/**
 * The facts only one kind has, from its body: what a piece's sealed summary stores (stage/store/summary-content.ts)
 * and what the Library's peek computes when a summary is not there yet (ui/apps/library/piece-peek.ts). One table, so
 * the two can never disagree; a kind with no special facts has none.
 */
export const kindFacts = (kind: string, body: Record<string, unknown>): KindFacts => (Object.hasOwn(KIND_FACTS, kind) ? KIND_FACTS[kind]!(body) : {});
