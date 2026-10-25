/**
 * The walkthrough's step logic (RoleCall packages/macros choice-stepper.ts): one step per choice group in declaration order, a leading
 * "about" step when the preset has a readme, and a closing summary. A step may advance only when its group's own invariants hold; declared
 * defaults prefill, so a fresh run can always advance. Pure; the modal and the saving live elsewhere.
 */
import { strArray } from "../guards";
import type { ChoiceGroup, ChoiceSelections } from "../macros/choice-groups";

export type StepperStep = { kind: "readme"; readme: string } | { kind: "group"; group: ChoiceGroup } | { kind: "summary" };

export interface SummaryRow { groupId: string; groupLabel: string; selectedLabels: string[]; isDefault: boolean }

/** What the peek button shows for one block an option names. */
export interface PromptPeek { name: string; content: string }

export function buildSteps(groups: ChoiceGroup[], readme?: string): StepperStep[] {
  const about: StepperStep[] = readme !== undefined && readme.trim() !== "" ? [{ kind: "readme", readme }] : [];
  return [...about, ...groups.map((group): StepperStep => ({ kind: "group", group })), { kind: "summary" }];
}

/** Block id -> peek, from the preset's blocks (a blank name falls back to the id, a missing body to empty). */
export const buildPromptPeekMap = (prompts: ReadonlyArray<{ id: string; name: string; content: string | null }>): Record<string, PromptPeek> =>
  Object.fromEntries(prompts.map((p) => [p.id, { name: p.name !== "" ? p.name : p.id, content: p.content ?? "" }]));

/** How many more picks the group needs before the walkthrough may advance; 0 is satisfied. */
export function selectionShortfall(group: ChoiceGroup, selections: ChoiceSelections): number {
  const value = selections[group.id];
  if (group.type === "toggle" || group.type === "input") return 0;
  if (group.type === "select_one") return typeof value === "string" && group.options.some((o) => o.id === value) ? 0 : 1;
  return Math.max(0, (group.min ?? 0) - strArray(value).length);
}

export const canAdvance = (group: ChoiceGroup, selections: ChoiceSelections): boolean => selectionShortfall(group, selections) === 0;

/** Whether a group's effective answer is its declared default (a select_many compares as a set). */
export function isDefaultSelection(group: ChoiceGroup, value: ChoiceSelections[string] | undefined): boolean {
  if (group.type !== "select_many") return value === group.default;
  const picked = new Set(strArray(value));
  const defaults = group.default as string[];
  return picked.size === defaults.length && defaults.every((id) => picked.has(id));
}

export const customizedCount = (groups: ChoiceGroup[], selections: ChoiceSelections): number => groups.filter((g) => !isDefaultSelection(g, selections[g.id])).length;

export function buildSummary(groups: ChoiceGroup[], selections: ChoiceSelections): SummaryRow[] {
  return groups.map((group) => {
    const value = selections[group.id];
    const selectedLabels =
      group.type === "toggle" ? [value === true ? "On" : "Off"]
        : group.type === "input" ? [typeof value === "string" ? value : (group.default as string)]
          : group.options.filter((o) => (typeof value === "string" ? value === o.id : strArray(value).includes(o.id))).map((o) => o.label);
    return { groupId: group.id, groupLabel: group.label, selectedLabels, isDefault: isDefaultSelection(group, value) };
  });
}
