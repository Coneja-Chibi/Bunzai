/**
 * A preset's choice groups as the assembler and the Preset tab read them: the canonical `PresetBody.choices` (what the RoleCall and
 * Marinara adapters fill) mapped to RoleCall's `ChoiceGroup` with the validation of its `parseGroup` (packages/macros
 * choice-groups.ts:117-208). A group RoleCall would refuse is refused here: a select_one needs a default that is one of its options, a
 * select_many a default that meets its own minimum, an input a default. The YAML carrier `parseChoiceGroups` reads is the importer's
 * business (formats/rolecall/preset.ts), so no YAML parser is needed here. Pure.
 */
import { isRecord, presentStrArray, strArray } from "../guards";
import type { ChoiceGroup, ChoiceOption, ChoiceSelections } from "../macros/choice-groups";
import { choicePromptEnabledStates } from "../macros/choice-groups";
import type { PresetChoice } from "../../entities/preset/schema";

/** An input's chip row stops being tappable past a handful of entries (RoleCall: eight). */
const SUGGESTIONS_MAX = 8;

function groupOf(c: PresetChoice): ChoiceGroup | null {
  if (!c.id) return null;
  const base = { id: c.id, label: c.label || c.id, ...(c.readme ? { description: c.readme } : {}) };
  const options: ChoiceOption[] = c.options.filter((o) => o.id).map((o) => ({ id: o.id, label: o.label || o.id, ...(o.description ? { description: o.description } : {}), prompts: strArray(o.enablesPrompts) }));
  if (c.type === "toggle") return { ...base, type: "toggle", options, default: c.default === true, prompts: strArray(c.extras?.["prompts"]) };
  if (c.type === "input") {
    if (typeof c.default !== "string" || c.default === "") return null;
    const suggestions = presentStrArray(c.suggestions)?.slice(0, SUGGESTIONS_MAX) ?? [];
    return { ...base, type: "input", options: [], default: c.default, prompts: [], ...(c.placeholder ? { placeholder: c.placeholder } : {}), ...(suggestions.length > 0 ? { suggestions } : {}) };
  }
  if (options.length === 0) return null;
  const ids = new Set(options.map((o) => o.id));
  if (c.type === "one") return typeof c.default === "string" && ids.has(c.default) ? { ...base, type: "select_one", options, default: c.default, prompts: [] } : null;
  const min = typeof c.min === "number" && Number.isInteger(c.min) && c.min > 0 ? Math.min(c.min, options.length) : undefined;
  const fallback = strArray(c.default).filter((id) => ids.has(id));
  // A default that breaks its minimum cannot resolve, so the group is rejected.
  if (min !== undefined && fallback.length < min) return null;
  return { ...base, type: "select_many", options, default: fallback, prompts: [], ...(min !== undefined ? { min } : {}) };
}

/** The groups that stand, in declaration order. */
export const toChoiceGroups = (choices: readonly PresetChoice[] | undefined): ChoiceGroup[] => (choices ?? []).flatMap((c) => groupOf(c) ?? []);

/**
 * The block switches a scene's request is built with: the choices set the baseline for every block they name, and the scene's own switches
 * go on top, a switch that matches the preset's own included (RoleCall: "Presence matters even when the value equals the shipped default").
 */
export function effectiveToggles(groups: ChoiceGroup[], selections: ChoiceSelections, own: Readonly<Record<string, boolean>> | undefined): Record<string, boolean> {
  return { ...choicePromptEnabledStates(groups, selections), ...own };
}

/** The pref that holds the person's saved choice answers for new and old scenes alike: `{ [presetId]: { [groupId]: answer } }` (RoleCall's `presetChoiceDefaults`). */
export const PRESET_CHOICE_DEFAULTS_KEY = "scenes.presetChoiceDefaults";

/** One preset's saved defaults out of the pref's raw value, keeping only answers of the shapes a group takes. */
export function defaultsFor(raw: unknown, presetId: string): Record<string, string | string[] | boolean> | undefined {
  const mine = isRecord(raw) && Object.hasOwn(raw, presetId) ? raw[presetId] : undefined;
  if (!isRecord(mine)) return undefined;
  const out: Record<string, string | string[] | boolean> = {};
  for (const [id, v] of Object.entries(mine)) {
    if (typeof v === "string" || typeof v === "boolean") out[id] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[id] = v as string[];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The answers a scene reads: its own, over the person's defaults, group by group (RoleCall seeds a new chat from the defaults; a group the scene never answered takes them). */
export const withDefaults = (defaults: Record<string, unknown> | undefined, own: Record<string, unknown> | undefined): Record<string, unknown> | undefined =>
  defaults || own ? { ...defaults, ...own } : undefined;
