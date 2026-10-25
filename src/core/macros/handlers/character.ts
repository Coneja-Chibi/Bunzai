/**
 * Character card macros: fields carried on the card beyond identity (scenario, examples, tags,
 * creator metadata, colors). Ported from RoleCall
 * inside ADR-012: no behavior change, only the registration mechanism.
 *
 * `scenario`, `mesExamples`, and `firstMessage` live on the base `MacroContext` (identity.ts's and
 * scene.ts's territory), so unlike RoleCall's own file, macros here read them directly with no cast.
 * The rest (`charVersion`, `charTags`, `charCreator`, `charCreatorNotes`, `charDepthPrompt`,
 * `charPrompt`, `charInstruction`) are card fields with no home on the trimmed base context, so they
 * stay behind the `CharacterCardContext` cast, RoleCall's own pattern.
 *
 * Two of RoleCall's definitions in this file never ran and are dropped:
 * - `description`/`personality`: identical in behavior to identity.ts's `chardescription`/
 *   `charpersonality` (both read `context.characterDescription || ""` /
 *   `context.characterPersonality || ""`). Their two unique aliases (`character.description`,
 *   `character.personality`) are merged onto identity.ts's winning definitions instead of kept as a
 *   dead stub here.
 * - `firstmessage`/`greeting`: scene.ts registers `firstmessage` first (SCENE_MACROS precedes
 *   CHARACTER_MACROS in catalog.ts), so this file's copy never runs. Its one alias, `greeting`, is
 *   added directly to scene.ts's `firstMessageMacro` instead of kept as a dead stub here.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

const scenarioMacro: MacroDefinition = {
  name: "scenario",
  aliases: ["character.scenario"],
  description: "The current scenario",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.scenario || "", success: true }),
};

const mesExamplesMacro: MacroDefinition = {
  name: "mesexamples",
  aliases: ["examples", "exampledialogue", "character.examples"],
  description: "Example dialogues, formatted",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (!context.mesExamples || context.mesExamples.length === 0) return { value: "", success: true };
    return { value: context.mesExamples.join("\n\n"), success: true };
  },
};

const mesExamplesRawMacro: MacroDefinition = {
  name: "mesexamplesraw",
  aliases: ["examplesraw"],
  description: "Example dialogues, raw/unformatted",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    if (!context.mesExamples || context.mesExamples.length === 0) return { value: "", success: true };
    return { value: context.mesExamples.join("\n"), success: true };
  },
};

const charVersionMacro: MacroDefinition = {
  name: "charversion",
  aliases: ["cardversion"],
  description: "The character card version",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charVersion || "", success: true }),
};

const charTagsMacro: MacroDefinition = {
  name: "chartags",
  aliases: ["tags"],
  description: "The character's tags as comma-separated list",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const tags = (context as CharacterCardContext).charTags;
    if (!tags || tags.length === 0) return { value: "", success: true };
    return { value: tags.join(", "), success: true };
  },
};

const charCreatorMacro: MacroDefinition = {
  name: "charcreator",
  aliases: ["cardcreator"],
  description: "The character's creator username",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charCreator || "", success: true }),
};

const charCreatorNotesMacro: MacroDefinition = {
  name: "charcreatornotes",
  aliases: ["creatornotes", "cardnotes"],
  description: "Creator's notes about the character card",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charCreatorNotes || "", success: true }),
};

/** {{charDepthPrompt}}: the character's depth-injected prompt (@ Depth Note). */
const charDepthPromptMacro: MacroDefinition = {
  name: "chardepthprompt",
  aliases: ["depthnote", "characterdepthnote"],
  description: "Character's depth-injected prompt (@ Depth Note)",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charDepthPrompt || "", success: true }),
};

/** {{charPrompt}}: the character's main prompt override. */
const charPromptMacro: MacroDefinition = {
  name: "charprompt",
  aliases: ["characterprompt"],
  description: "Character's main prompt override",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charPrompt || "", success: true }),
};

/** {{charInstruction}}: the character's post-history instructions (jailbreak). */
const charInstructionMacro: MacroDefinition = {
  name: "charinstruction",
  aliases: ["charjailbreak", "characterinstruction"],
  description: "Character's post-history instructions",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context as CharacterCardContext).charInstruction || "", success: true }),
};

const accentColorMacro: MacroDefinition = {
  name: "accentcolor",
  aliases: ["accent_color", "charcolor", "character.accent_color"],
  description: "The character's accent/theme color (hex)",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: context.characterAccentColor || "", success: true }),
};

const paletteMacro: MacroDefinition = {
  name: "palette",
  aliases: ["charpalette", "character.palette"],
  description: "The character's color palette as JSON array",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: context.characterPalette ? JSON.stringify(context.characterPalette) : "[]",
    success: true,
  }),
};

const gradientMacro: MacroDefinition = {
  name: "gradient",
  aliases: ["chargradient", "character.gradient"],
  description: "The character's gradient accent colors as JSON array",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: context.characterGradient ? JSON.stringify(context.characterGradient) : "[]",
    success: true,
  }),
};

/** Card fields with no home on the trimmed base `MacroContext` (see this file's header). */
export interface CharacterCardContext extends MacroContext {
  charVersion?: string;
  charTags?: string[];
  charCreator?: string;
  charCreatorNotes?: string;
  charDepthPrompt?: string;
  charPrompt?: string;
  charInstruction?: string;
}

export const CHARACTER_MACROS: readonly MacroDefinition[] = [
  scenarioMacro,
  mesExamplesMacro,
  mesExamplesRawMacro,
  charVersionMacro,
  charTagsMacro,
  charCreatorMacro,
  charCreatorNotesMacro,
  charDepthPromptMacro,
  charPromptMacro,
  charInstructionMacro,
  accentColorMacro,
  paletteMacro,
  gradientMacro,
];
