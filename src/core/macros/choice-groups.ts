/**
 * Choice groups: a preset declares select_one,
 * select_many, toggle, or input sections that render as real controls instead of banks of fake
 * toggle prompts. This file holds the types and what the {{choice}} family reads. Parsing a
 * preset's declaration (RoleCall accepts an object or a YAML string) belongs to the preset loader
 * port: `parseChoiceGroups` needs `js-yaml`, which stays
 * out of the macro engine, so it is not here.
 *
 * `resolveSelections` and `choiceValue` are ported (unchanged behavior, no `js-yaml` dependency)
 * because handlers/choice.ts needs `choiceValue`, and the ported RoleCall test corpus
 * (handlers/choice.test.ts) builds its fixtures with `resolveSelections` over hand-built
 * `ChoiceGroup` literals instead of `parseChoiceGroups`. RoleCall's other choice-groups.ts exports
 * (`parseChoiceGroups`, `choiceSelectionsForPreset`, `scopeLegacyChoiceSelections`,
 * `selectedPromptIds`, `referencedPromptIds`, `excludedPromptIds`,
 * `applyChoicePromptEnabledStates`) are preset-loader/assembler-time concerns, not read by any
 * macro handler. The three prompt-id functions are ported at the end of this file (the assembler reads them); parsing is core/preset/choices.ts,
 * over the canonical PresetBody.choices, and the selection store is ChatStore rule 42.
 */
import { strArray } from "../guards";

export type ChoiceGroupType = "select_one" | "select_many" | "toggle" | "input";

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  /** Prompt identifiers enabled while this option is selected. */
  prompts: string[];
  /** Scoped state writes applied while selected (scope:key to value). */
  set?: Record<string, string>;
}

export interface ChoiceGroup {
  id: string;
  label: string;
  type: ChoiceGroupType;
  description?: string;
  /** Long-form prose behind a "Read more" in the walkthrough. */
  readme?: string;
  options: ChoiceOption[];
  /** select_one: an option id; select_many: option ids; toggle: a boolean. */
  default: string | string[] | boolean;
  /** toggle only: prompts enabled while on. */
  prompts: string[];
  /** select_many only: the fewest options that must stay selected. */
  min?: number;
  /** input only: hint text in the empty field. */
  placeholder?: string;
  /** input only: example answers offered above the field. */
  suggestions?: string[];
}

/** The effective selection per group id, defaults applied. */
export type ChoiceSelections = Record<string, string | string[] | boolean>;

/**
 * Effective selections: saved values win where valid, declared defaults fill everything else.
 * Unknown option ids in saved state fall back to the default.
 */
export function resolveSelections(groups: ChoiceGroup[], saved: Record<string, unknown> | undefined): ChoiceSelections {
  const selections: ChoiceSelections = {};
  for (const group of groups) {
    const savedValue = saved?.[group.id];
    if (group.type === "toggle") {
      selections[group.id] = typeof savedValue === "boolean" ? savedValue : (group.default as boolean);
      continue;
    }
    if (group.type === "input") {
      selections[group.id] = typeof savedValue === "string" && savedValue.trim() !== "" ? savedValue : (group.default as string);
      continue;
    }
    const optionIds = new Set(group.options.map((o) => o.id));
    if (group.type === "select_one") {
      selections[group.id] = typeof savedValue === "string" && optionIds.has(savedValue) ? savedValue : (group.default as string);
      continue;
    }
    const savedMany = Array.isArray(savedValue) ? strArray(savedValue).filter((id) => optionIds.has(id)) : undefined;
    // A saved set below the group's min can't stand; the declared default is the only state
    // guaranteed to satisfy it.
    selections[group.id] = savedMany !== undefined && savedMany.length >= (group.min ?? 0) ? savedMany : [...(group.default as string[])];
  }
  return selections;
}

/** What {{choice::group}} prints: id, comma-joined ids, or true/false. */
export function choiceValue(groups: ChoiceGroup[], selections: ChoiceSelections, groupId: string): string {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return "";
  const value = selections[group.id];
  if (group.type === "toggle") return value === true ? "true" : "false";
  if (typeof value === "string") return value;
  return strArray(value).join(", ");
}

/** The block ids the effective selection turns on, in declaration order. */
export function selectedPromptIds(groups: ChoiceGroup[], selections: ChoiceSelections): string[] {
  const ids: string[] = [];
  for (const group of groups) {
    const value = selections[group.id];
    if (group.type === "toggle") {
      if (value === true) ids.push(...group.prompts);
      continue;
    }
    const picked = new Set(typeof value === "string" ? [value] : strArray(value));
    for (const option of group.options) if (picked.has(option.id)) ids.push(...option.prompts);
  }
  return ids;
}

/** Every block id any option or toggle names, selected or not. */
export function referencedPromptIds(groups: ChoiceGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group.prompts) ids.add(id);
    for (const option of group.options) for (const id of option.prompts) ids.add(id);
  }
  return ids;
}

/**
 * The enabled state of every block a choice group controls (RoleCall's choicePromptEnabledStates): the selection is the baseline, so a
 * selected option turns its blocks on and every other referenced block is off. A block no group names is not here.
 */
export function choicePromptEnabledStates(groups: ChoiceGroup[], selections: ChoiceSelections): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  for (const id of referencedPromptIds(groups)) states[id] = false;
  for (const id of selectedPromptIds(groups, selections)) states[id] = true;
  return states;
}

/** The blocks assembly must drop: named by some group but not turned on by the selection. */
export function excludedPromptIds(groups: ChoiceGroup[], selections: ChoiceSelections): Set<string> {
  const excluded = referencedPromptIds(groups);
  for (const id of selectedPromptIds(groups, selections)) excluded.delete(id);
  return excluded;
}
