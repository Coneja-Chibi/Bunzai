/**
 * Roleplay convenience macros: shorthand for `{{getvar::x}}` on a handful of common story
 * variables (mood, relationship, location, ...), so lorebook side effects and preset authors don't
 * have to spell out `{{getvar::mood}}` everywhere. Ported from RoleCall
 * inside ADR-012: no behavior change, only the
 * registration mechanism.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

const localVar = (context: MacroContext, key: string): string => context.localVariables.get(key)?.value?.toString() || "";

const moodMacro: MacroDefinition = {
  name: "mood",
  description: "Current mood variable (shorthand for {{getvar::mood}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "mood"), success: true }),
};

const relationshipMacro: MacroDefinition = {
  name: "relationship",
  aliases: ["rel"],
  description: "Relationship status variable (shorthand for {{getvar::relationship}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "relationship"), success: true }),
};

const locationMacro: MacroDefinition = {
  name: "location",
  aliases: ["loc", "place"],
  description: "Current location variable (shorthand for {{getvar::location}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "location"), success: true }),
};

const timeOfDayMacro: MacroDefinition = {
  name: "timeofday",
  aliases: ["tod", "storytime"],
  description: "In-story time of day variable (shorthand for {{getvar::timeOfDay}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "timeOfDay"), success: true }),
};

const trustMacro: MacroDefinition = {
  name: "trust",
  description: "Trust level variable (shorthand for {{getvar::trust}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "trust"), success: true }),
};

const affectionMacro: MacroDefinition = {
  name: "affection",
  aliases: ["love"],
  description: "Affection level variable (shorthand for {{getvar::affection}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "affection"), success: true }),
};

const tensionMacro: MacroDefinition = {
  name: "tension",
  description: "Scene tension variable (shorthand for {{getvar::tension}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "tension"), success: true }),
};

const weatherMacro: MacroDefinition = {
  name: "weather",
  description: "Weather variable (shorthand for {{getvar::weather}})",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: localVar(context, "weather"), success: true }),
};

export const ROLEPLAY_MACROS: readonly MacroDefinition[] = [
  moodMacro,
  relationshipMacro,
  locationMacro,
  timeOfDayMacro,
  trustMacro,
  affectionMacro,
  tensionMacro,
  weatherMacro,
];
