/**
 * The Anti-Slop catalog (RoleCall rc lib/post-gen-actions/slopism-sets.ts and banks.generated.ts, 156 banks in 69 sets, plus 8 craft-floor
 * rules for the editor): which sets exist, which banks each holds, how much of a bank a depth sends, and what each kind of bank asks the
 * model to do. The bank text is `banks.json`, RoleCall's own catalog with its em dashes and arrows written as plain hyphens. Read-only
 * data: a person's own banks live in the library (studio/final-cut-library.ts) and join at run time, never in this file.
 */
import data from "./banks.json";

export type BankKind = "phrase" | "structure" | "technique" | "lexical" | "wordbank" | "pattern";
export type BankScope = "always" | "scene" | "response" | "turn-history";
/** The kinds and scopes a person can give a bank they author (a wordbank is catalog-only: hundreds of entries in bulk). */
export const BANK_KINDS: readonly BankKind[] = ["phrase", "pattern", "technique", "lexical", "structure"];
export const BANK_SCOPES: readonly BankScope[] = ["always", "scene", "response", "turn-history"];
export type BankDepth = "minimal" | "light" | "standard" | "deep";

export interface Bank {
  label: string;
  kind: BankKind;
  /** Recognition prose: what the slop is, in a paragraph the model reads to spot it in any surface form. */
  pattern: string;
  examples: string[];
  replace: string;
  why?: string;
  /** When the bank fires. Absent means always. */
  scope?: BankScope;
  /** Banks whose replacement guidance pushes the other way; both stay usable, the panel warns when both are on. */
  conflictsWith?: string[];
  family?: string;
  /** A base bank this one layers on; shared entries dedupe at assembly. */
  extends?: string;
}

export interface BankSet { id: string; label: string; description: string; banks: string[] }
export interface EditorRule { id: string; label: string; target: string; scope: BankScope; why: string; body: string }

export const BANKS = data.banks as unknown as Readonly<Record<string, Bank>>;
export const SETS = data.sets as readonly BankSet[];
export const EDITOR_RULES = data.rules as unknown as Readonly<Record<string, EditorRule>>;
const ALIASES = data.aliases as Readonly<Record<string, string>>;
/** A set id an older config may carry, and the set it became. */
const SET_ALIASES: Readonly<Record<string, string>> = { "universal-core": "universal-tells" };

export const BANK_DEPTH: Readonly<Record<BankDepth, { label: string; hint: string; examples: number; action: boolean; replace: boolean }>> = {
  minimal: { label: "Minimal", hint: "label + pattern only", examples: 0, action: false, replace: false },
  light: { label: "Light", hint: "+ action line + 2 examples", examples: 2, action: true, replace: false },
  standard: { label: "Standard", hint: "+ 5 examples + replacement guidance", examples: 5, action: true, replace: true },
  deep: { label: "Deep", hint: "all examples + replacement (max specificity)", examples: Number.POSITIVE_INFINITY, action: true, replace: true },
};

/** What the model does for each kind of bank (RoleCall KIND_ACTION). */
export const KIND_ACTION: Readonly<Record<BankKind, string>> = {
  phrase: "Locate this exact phrase or close variant. Substitute with the replacement guidance below or cut entirely.",
  structure: "Identify any sentence using this rhythm/construction. Rewrite the sentence so the pattern is broken, not just the example phrase swapped.",
  technique: "Find any prose using this technique anywhere in the passage. Rewrite the surrounding sentences to use the alternative technique below.",
  lexical: "Find every occurrence of these words or close synonyms. Replace with the alternative below; if no replacement fits, cut the modifier.",
  wordbank: "Treat every entry below as banned. Match case-insensitively and include inflections (delve/delves/delved/delving). Replace with the plain alternative below or cut. This is a hard ban - no occurrences should remain.",
  pattern: "Scan this response (and prior turns where context allows) for the recurrence below. A single instance is fine; the loop is the slop. Identify what's being recycled, then break the loop by changing what the prose is doing at that moment, or by cutting the recycled beat. Vocabulary swap alone fails this kind: the same beat with different words is still the same beat.",
};

/** The canonical bank id for one a saved config may spell the old way. */
export const resolveBankId = (id: string): string => ALIASES[id] ?? id;
export const resolveSetId = (id: string): string => SET_ALIASES[id] ?? id;
export const getSet = (id: string): BankSet | undefined => SETS.find((s) => s.id === resolveSetId(id));
export const getBank = (id: string): Bank | undefined => BANKS[resolveBankId(id)];
export const bankIdsInSet = (setId: string): string[] => getSet(setId)?.banks ?? [];

/** The depth a bank is sent at: its own override, else the pass's default, else standard. */
export const depthFor = (bankId: string, defaultDepth: BankDepth | undefined, overrides: Readonly<Record<string, BankDepth>> | undefined): BankDepth =>
  overrides?.[bankId] ?? defaultDepth ?? "standard";

/** Strips the light markdown a bank's text carries so it reads as one line of plain words. */
export const stripMd = (s: string): string =>
  s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/_(.+?)_/g, "$1").replace(/\s+/g, " ").trim();

/** Normalized forms of one entry, so the same phrase listed under two banks is sent once (RoleCall normalizeEntry and entryDedupeForms). */
function normalizeEntry(s: string): string {
  return s
    .toLowerCase()
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^["'“”‘’`]+|["'“”‘’`.,!?:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:her|his|their|she|he|they|the|a|an|my|your|its) )+/, "");
}

export function entryForms(raw: string): string[] {
  const cleaned = raw.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const forms = new Set<string>();
  for (const part of [cleaned, ...cleaned.split(/\s+\/\s+/)]) {
    const norm = normalizeEntry(part);
    const multi = norm.includes(" ");
    if ((multi && norm.length >= 6) || (!multi && norm.length >= 12)) forms.add(norm);
  }
  return [...forms];
}
