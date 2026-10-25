/**
 * Character editor core - the pure logic under the Workbench's writable pane, transcribed from
 * RoleCall's CharacterEditorBento and re-homed onto the canonical character body. Nothing here
 * touches the DOM; Editor.tsx renders it.
 *
 * Field-order ids are RC's verbatim, so a card that traveled RC -> Studios keeps its saved card
 * order and can round-trip; ids not rendered yet are KEPT in place, never dropped.
 */
import { deepEq } from "../../../core/guards";
import { writeCharacterPath } from "../../../entities/character/capabilities/operations";
import {
  inheritVariantOverride,
  variantOverridePresent,
  writeVariantOverride,
} from "../../../entities/character/variant-edit";

/** Every order id the format family knows (RC DEFAULT_FIELD_ORDER, verbatim). */
export const KNOWN_FIELD_ORDER: string[] = [
  "description",
  "personality",
  "scenario",
  "firstMes",
  "alternateGreetings",
  "mesExample",
  "creators-note",
];

/**
 * Saved order -> working order: keep saved ids that are still known (in their saved positions),
 * append known ids the save predates. Junk and unknown ids drop; null/absent reads as the default.
 */
export function reconcileOrder(saved: unknown): string[] {
  if (!Array.isArray(saved) || saved.length === 0) return [...KNOWN_FIELD_ORDER];
  const valid = saved.filter((f): f is string => typeof f === "string" && KNOWN_FIELD_ORDER.includes(f));
  const missing = KNOWN_FIELD_ORDER.filter((f) => !valid.includes(f));
  const merged = [...valid, ...missing];
  return merged.length ? merged : [...KNOWN_FIELD_ORDER];
}

// ====================================================================================================
// v2 - the vs-editor-2 surface (locked wireframe): multi-select platform lens, three-region bento,
// guided steps, generic draft ops, completion chips. Pure logic only; Editor.tsx renders it.
// ====================================================================================================

import { coversPath } from "../../../core/coverage";

/** The guided mode's fixed step order (RC's stepper, transcribed). */
export const STEP_ORDER = ["casting", "prompts", "advanced", "finalize"] as const;
export type StepId = (typeof STEP_ORDER)[number];

/** One bento card of the vs-editor-2 surface: a region, the canonical paths it edits (the card
 * side of the lens), and the guided step that owns it. Prose ids stay RC field-order ids. */
export interface EditorCard {
  id: string;
  label: string;
  region: "left" | "center" | "right";
  paths: string[];
  step: StepId;
}

/** The transcribed card set. Order within a region is the render order (center prose cards still
 * reorder by presentation.fieldOrder; this list is the lens/step registry, not the visual order). */
export const EDITOR_CARDS: EditorCard[] = [
  { id: "portrait", label: "portrait", region: "left", paths: ["media.portrait", "media.assets"], step: "casting" },
  { id: "identity", label: "identity", region: "center", paths: ["identity.name", "identity.tagline", "discovery.tags", "discovery.rating"], step: "casting" },
  { id: "casting", label: "casting card", region: "center", paths: ["identity.fullName", "identity.title", "identity.age", "identity.pronouns"], step: "casting" },
  { id: "description", label: "description", region: "center", paths: ["identity.description"], step: "prompts" },
  { id: "personality", label: "personality", region: "center", paths: ["persona.personality"], step: "prompts" },
  { id: "scenario", label: "scenario", region: "center", paths: ["persona.scenario"], step: "prompts" },
  { id: "firstMes", label: "first message", region: "center", paths: ["greetings.firstMessage"], step: "advanced" },
  { id: "alternateGreetings", label: "alt greetings", region: "center", paths: ["greetings.alternateGreetings"], step: "advanced" },
  { id: "mesExample", label: "example messages", region: "center", paths: ["examples.exampleMessages"], step: "advanced" },
  { id: "gradient", label: "signature colors", region: "center", paths: ["presentation.gradientColors"], step: "casting" },
  { id: "palette", label: "color palette", region: "right", paths: ["presentation.palette", "presentation.signatureColor"], step: "casting" },
  { id: "background", label: "default background", region: "right", paths: ["presentation.background"], step: "finalize" },
  { id: "spotlight", label: "spotlight definitions", region: "right", paths: ["presentation.spoilers"], step: "finalize" },
];

/** A platform's coverage claims as the lens consumes them (mirrors /api/coverage entries). */
export interface LensPlatform {
  id: string;
  carries: string[];
}

export interface LensVerdict {
  /** no SELECTED platform carries any of the card's paths (dim or hide per the off-target pref) */
  off: boolean;
  /** selected platform ids that do NOT carry this card (the "not carried on: X" tag) */
  missing: string[];
}

/** The multi-select lens rule (vs-editor-2): empty selection = the full card, nothing judged;
 * otherwise a card is carried by a platform when ANY of its paths is covered. */
export function lensVerdict(cardPaths: string[], selected: string[], platforms: LensPlatform[]): LensVerdict {
  if (selected.length === 0) return { off: false, missing: [] };
  const byId = new Map(platforms.map((p) => [p.id, p]));
  const missing: string[] = [];
  let carried = false;
  for (const id of selected) {
    const platform = byId.get(id);
    const carries = platform !== undefined && cardPaths.some((path) => coversPath({ carries: platform.carries }, path));
    if (carries) carried = true;
    else missing.push(id);
  }
  return { off: !carried, missing };
}

const isEmptyValue = (v: unknown): boolean =>
  v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Read any value at a dot path ("" segments never occur; absent = undefined). */
export function readPath(body: unknown, dotPath: string): unknown {
  let cur: unknown = body;
  for (const key of dotPath.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Immutably write any value at a dot path, returning a NEW body. Empty values ("" / [] /
 * undefined) DELETE the leaf - canonical stores absence, never empty husks. Untouched branches
 * are structurally shared, and the no-data-loss law holds: nothing outside the path changes. */
export function writePath(body: Record<string, unknown>, dotPath: string, value: unknown): Record<string, unknown> {
  return writeCharacterPath(body, dotPath, value);
}

/**
 * Override-tree write: keep present "" and [] as intentional blanks. Does not auto-delete on empty;
 * use inheritOverridePath to drop a key and resume base inheritance. Base-body writePath is unchanged.
 */
export function writeOverridePath(
  body: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): Record<string, unknown> {
  return writeVariantOverride(body, dotPath, value);
}

/** Delete a leaf on an override tree so the base value is inherited again. */
export function inheritOverridePath(body: Record<string, unknown>, dotPath: string): Record<string, unknown> {
  return inheritVariantOverride(body, dotPath);
}

/** True when every segment of the dot path is a PRESENT key ("" and [] count as overrides). */
export function hasOverridePath(overrides: unknown, dotPath: string): boolean {
  return variantOverridePresent(overrides, dotPath);
}

/** JSON-shape structural equality (drafts and baselines are parsed JSON; functions never appear).
 * Lives in `_shared/editor-state.ts` now: the Prompting wing needed it
 * too, and this re-export keeps every one of this file's existing callers unchanged. */
export { deepEq };

// ====================================================================================================
// Async save reconciliation: snapshot was submitted; live may have advanced during the await.
// ====================================================================================================

/** One domain after three-way reconcile (live vs submitted vs accepted baseline). */
export interface ReconciledDomain<T> {
  /** Value that should remain in the form (newer edit kept, else accepted). */
  current: T;
  /** What storage accepted; becomes the new baseline. Always a fresh clone. */
  baseline: T;
  /** True when current still differs from the accepted baseline. */
  dirty: boolean;
}

/**
 * Three-way reconcile after an async save succeeds.
 * 1. If live still equals the submitted snapshot, adopt the accepted/persisted value.
 * 2. If live differs, retain live (a newer local edit) and do not overwrite it.
 * 3. Baseline is always a clone of the accepted snapshot (defaults to submitted).
 */
export function reconcileAfterSave<T>(args: {
  live: T;
  submitted: T;
  /** Persisted representation when known; defaults to the submitted snapshot. */
  accepted?: T;
}): ReconciledDomain<T> {
  const accepted = args.accepted !== undefined ? args.accepted : args.submitted;
  const baseline = structuredClone(accepted) as T;
  if (deepEq(args.live, args.submitted)) {
    return {
      current: structuredClone(accepted) as T,
      baseline,
      dirty: false,
    };
  }
  // Newer local edit: keep the live reference (form owns it); isolate the baseline clone.
  return {
    current: args.live,
    baseline,
    dirty: !deepEq(args.live, accepted),
  };
}

/** Status bar copy after a successful save: clean vs newer pending edits. */
export function saveOutcomeStatus(name: string, stillDirty: boolean): string {
  return stillDirty
    ? `${name} saved; newer changes not yet saved`
    : `${name} saved`;
}

/** The completion chips (RC's checklist, transcribed): real facts about the draft, no vibes. */
export interface Completion {
  portrait: boolean;
  name: boolean;
  corePrompts: boolean;
  greeting: boolean;
  tags: boolean;
}

export function completionOf(body: unknown): Completion {
  const has = (p: string): boolean => !isEmptyValue(readPath(body, p));
  return {
    portrait: has("media.portrait"),
    name: has("identity.name"),
    corePrompts: has("identity.description") && has("persona.personality"),
    greeting: has("greetings.firstMessage"),
    tags: has("discovery.tags"),
  };
}

/** The prose fields the macro inventory scans (the fields that carry {{macros}}). */
const MACRO_SCAN_PATHS = [
  "identity.description", "persona.personality", "persona.scenario", "persona.appearance",
  "greetings.firstMessage", "examples.exampleMessages", "prompts.systemPrompt",
  "prompts.postHistoryInstructions", "prompts.prefill", "prompts.additionalText",
] as const;

/**
 * The {{macro}} inventory across the prose fields: every macro name with how many times it appears,
 * most-used first. Pure, so the editor's macro card is a view over it.
 */
export function macroInventory(body: unknown): Array<[string, number]> {
  const tally = new Map<string, number>();
  for (const path of MACRO_SCAN_PATHS) {
    const v = readPath(body, path);
    const text = typeof v === "string" ? v : "";
    for (const mm of text.matchAll(/\{\{\s*([^}|:]+?)\s*(?:[:|][^}]*)?\}\}/g)) {
      const name = `{{${mm[1]!.trim()}}}`;
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
}
