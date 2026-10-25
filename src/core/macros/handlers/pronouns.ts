/**
 * Pronoun macros: gender-aware pronouns for the character and the user. Ported from RoleCall
 * inside ADR-012: no behavior change, only the
 * registration mechanism. The capitalized `They`/`Them`/`Their` stay distinct names from their
 * lowercase forms (registry.ts's exact-case lookup), matching RoleCall's own registry rules.
 */
import type { MacroContext, MacroDefinition, MacroResult, Pronouns } from "../types";

const PRONOUN_SETS: Record<"male" | "female" | "neutral", Pronouns> = {
  male: { they: "he", them: "him", their: "his", theirs: "his", themself: "himself" },
  female: { they: "she", them: "her", their: "her", theirs: "hers", themself: "herself" },
  neutral: { they: "they", them: "them", their: "their", theirs: "theirs", themself: "themself" },
};

const characterPronouns = (context: MacroContext): Pronouns => context.characterPronouns || PRONOUN_SETS.neutral;
const userPronouns = (context: MacroContext): Pronouns => context.userPronouns || PRONOUN_SETS.neutral;
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const theyMacro: MacroDefinition = {
  name: "they",
  aliases: ["he/she", "heshe"],
  description: "Character's subject pronoun (he/she/they)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: characterPronouns(context).they, success: true }),
};

const themMacro: MacroDefinition = {
  name: "them",
  aliases: ["him/her", "himher"],
  description: "Character's object pronoun (him/her/them)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: characterPronouns(context).them, success: true }),
};

const theirMacro: MacroDefinition = {
  name: "their",
  aliases: ["his/her", "hisher"],
  description: "Character's possessive determiner (his/her/their)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: characterPronouns(context).their, success: true }),
};

const theirsMacro: MacroDefinition = {
  name: "theirs",
  aliases: ["his/hers", "hishers"],
  description: "Character's possessive pronoun (his/hers/theirs)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: characterPronouns(context).theirs, success: true }),
};

const themselfMacro: MacroDefinition = {
  name: "themself",
  aliases: ["himself/herself", "himselfherself"],
  description: "Character's reflexive pronoun (himself/herself/themself)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: characterPronouns(context).themself, success: true }),
};

const theyCapMacro: MacroDefinition = {
  name: "They",
  aliases: ["He/She", "HeShe"],
  description: "Character's subject pronoun, capitalized",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: capitalize(characterPronouns(context).they), success: true }),
};

const themCapMacro: MacroDefinition = {
  name: "Them",
  aliases: ["Him/Her", "HimHer"],
  description: "Character's object pronoun, capitalized",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: capitalize(characterPronouns(context).them), success: true }),
};

const theirCapMacro: MacroDefinition = {
  name: "Their",
  aliases: ["His/Her", "HisHer"],
  description: "Character's possessive determiner, capitalized",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: capitalize(characterPronouns(context).their), success: true }),
};

const utheyMacro: MacroDefinition = {
  name: "uthey",
  aliases: ["userthey", "userhe/she"],
  description: "User's subject pronoun (he/she/they)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: userPronouns(context).they, success: true }),
};

const uthemMacro: MacroDefinition = {
  name: "uthem",
  aliases: ["userthem", "userhim/her"],
  description: "User's object pronoun (him/her/them)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: userPronouns(context).them, success: true }),
};

const utheirMacro: MacroDefinition = {
  name: "utheir",
  aliases: ["usertheir", "userhis/her"],
  description: "User's possessive determiner (his/her/their)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: userPronouns(context).their, success: true }),
};

const utheirsMacro: MacroDefinition = {
  name: "utheirs",
  aliases: ["usertheirs"],
  description: "User's possessive pronoun (his/hers/theirs)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: userPronouns(context).theirs, success: true }),
};

const uthemselfMacro: MacroDefinition = {
  name: "uthemself",
  aliases: ["userthemself"],
  description: "User's reflexive pronoun (himself/herself/themself)",
  category: "pronouns",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: userPronouns(context).themself, success: true }),
};

export const PRONOUNS_MACROS: readonly MacroDefinition[] = [
  theyMacro,
  themMacro,
  theirMacro,
  theirsMacro,
  themselfMacro,
  theyCapMacro,
  themCapMacro,
  theirCapMacro,
  utheyMacro,
  uthemMacro,
  utheirMacro,
  utheirsMacro,
  uthemselfMacro,
];
