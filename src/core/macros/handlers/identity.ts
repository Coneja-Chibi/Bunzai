/**
 * Identity macros: character, user, and model identity. Ported from RoleCall
 * inside ADR-012: no behavior change, only the
 * registration mechanism (a plain array instead of a `registerMacros` call).
 *
 * Deviation from a verbatim port: `chardescription`/`charpersonality` also collide with
 * `character.ts`'s `description`/`personality` (each family declares the other's primary name as
 * its own alias). Both pairs of handlers are behaviorally identical
 * (`context.characterDescription || ""` / `context.characterPersonality || ""`), so rather than
 * keep a second, dead copy in character.ts, the two aliases character.ts uniquely contributed
 * (`character.description`, `character.personality`, present nowhere in this file) are merged
 * directly onto the winning definitions below. See character.ts's header for the matching removal.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

const charMacro: MacroDefinition = {
  name: "char",
  aliases: ["character", "bot"],
  description: "The character's name",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.characterName, success: true }),
};

const userMacro: MacroDefinition = {
  name: "user",
  aliases: ["player"],
  description: "The user's name",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.userName, success: true }),
};

const personaMacro: MacroDefinition = {
  name: "persona",
  aliases: ["userpersona"],
  description: "The user's persona description",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.userPersona || "", success: true }),
};

const modelMacro: MacroDefinition = {
  name: "model",
  aliases: ["aimodel", "llm"],
  description: "The current AI model name",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.modelName || "Unknown", success: true }),
};

const charDescriptionMacro: MacroDefinition = {
  name: "chardescription",
  // "character.description" merged in from character.ts's dead descriptionMacro; see header.
  aliases: ["chardesc", "description", "character.description"],
  description: "The character's full description",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.characterDescription || "", success: true }),
};

const charPersonalityMacro: MacroDefinition = {
  name: "charpersonality",
  // "character.personality" merged in from character.ts's dead personalityMacro; see header.
  aliases: ["personality", "character.personality"],
  description: "The character's personality field",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.characterPersonality || "", success: true }),
};

/**
 * {{group}}: the group chat name. Outside a group chat there is no group, so this falls back to
 * the character's name, matching SillyTavern, where {{group}} resolves to {{char}} in solo chats.
 */
const groupMacro: MacroDefinition = {
  name: "group",
  aliases: ["groupname"],
  description: "The group chat name (falls back to the character name outside a group)",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.groupName || context.characterName || "", success: true }),
};

const personaColorMacro: MacroDefinition = {
  name: "personacolor",
  aliases: ["persona_color", "persona.color"],
  description: "The persona's accent/signature color (hex)",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.personaAccentColor || "", success: true }),
};

const personaPaletteMacro: MacroDefinition = {
  name: "personapalette",
  aliases: ["persona_palette", "persona.palette"],
  description: "The persona's color palette as JSON array",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: context.personaPalette ? JSON.stringify(context.personaPalette) : "[]",
    success: true,
  }),
};

const personaGradientMacro: MacroDefinition = {
  name: "personagradient",
  aliases: ["persona_gradient", "persona.gradient"],
  description: "The persona's gradient accent colors as JSON array",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: context.personaGradient ? JSON.stringify(context.personaGradient) : "[]",
    success: true,
  }),
};

export const IDENTITY_MACROS: readonly MacroDefinition[] = [
  charMacro,
  userMacro,
  personaMacro,
  modelMacro,
  charDescriptionMacro,
  charPersonalityMacro,
  groupMacro,
  personaColorMacro,
  personaPaletteMacro,
  personaGradientMacro,
];
