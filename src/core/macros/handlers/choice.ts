/**
 * Choice macros: read the preset's choice-group selections (choice-groups.ts) at render time, so
 * prompts can react to what the user picked in the preset UI without toggle-prompt gymnastics.
 *
 *   {{choice::group}}            -> selected id / comma-joined ids / true|false
 *   {{chosen::group::option}}    -> "true"/"false" (select_many: membership; toggle: option arg
 *                                    ignored, state itself)
 *
 * Composes with {{switch}} for branching and {{when_enabled}}-style gating. Groups and effective
 * selections arrive on MacroContext (`choiceGroups`/`choiceSelections`), defaults already applied
 * by `resolveSelections`.
 *
 * Ported from RoleCall inside ADR-012: no behavior
 * change, only the registration mechanism.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";
import { choiceValue } from "../choice-groups";

const choiceMacro: MacroDefinition = {
  name: "choice",
  aliases: ["choice_value"],
  description: "Selected option of a preset choice group: id, comma-joined ids, or true/false.",
  args: [{ name: "group_id", description: "Choice group identifier", required: true }],
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const groupId = args[0]?.trim();
    if (!groupId) return { value: "", success: false, error: "Choice group id required" };
    return { value: choiceValue(context.choiceGroups ?? [], context.choiceSelections ?? {}, groupId), success: true };
  },
};

const chosenMacro: MacroDefinition = {
  name: "chosen",
  aliases: ["choice_is"],
  description: 'Is the named option selected in a preset choice group? Returns "true"/"false".',
  args: [
    { name: "group_id", description: "Choice group identifier", required: true },
    { name: "option_id", description: "Option id (ignored for toggle groups)", required: false },
  ],
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const groupId = args[0]?.trim();
    if (!groupId) return { value: "", success: false, error: "Choice group id required" };
    const group = (context.choiceGroups ?? []).find((g) => g.id === groupId);
    if (!group) return { value: "false", success: true };

    const value = (context.choiceSelections ?? {})[groupId];
    if (group.type === "toggle") return { value: value === true ? "true" : "false", success: true };

    const optionId = args[1]?.trim();
    if (!optionId) return { value: "", success: false, error: "Option id required for select groups" };
    const picked = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
    return { value: picked.includes(optionId) ? "true" : "false", success: true };
  },
};

export const CHOICE_MACROS: readonly MacroDefinition[] = [choiceMacro, chosenMacro];
