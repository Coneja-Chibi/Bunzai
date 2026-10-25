/**
 * The character fields RoleCall's assembler reads, taken from the canonical body instead of its
 * `characters` row (`prompt-assembly.ts` sections 3, 5.5 and 6, and `buildCardFieldMacroContext`).
 */
import type { CharacterBody } from "../../entities/character/schema";
import { paletteTagLines } from "../persona/inject";
import type { CharacterCardContext } from "../macros/handlers/character";
import type { AssembledRole } from "./types";

export interface DepthNote {
  text: string;
  depth: number;
  role: AssembledRole;
}

export interface CardView {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  examples: string;
  postHistory: string;
  /** The named colors as XML tags, the form a persona's go in (persona/inject.ts); empty when the card has none. */
  paletteTags: string;
  /** Notes injected at a depth in the history (RoleCall's `details.prompt_depth_injections`). */
  depthNotes: DepthNote[];
  macroFields: Partial<CharacterCardContext>;
  /** RoleCall's character system prompt (section 6), each field expanded by `expand` in its order. */
  characterPrompt(expand: (text: string) => string): string;
}

/**
 * RoleCall's native depth notes: enabled, non-empty, depth clamped to 0 to 100. A SillyTavern card's
 * `depth_prompt` is not injected by RoleCall; it reaches the prompt only through {{charDepthPrompt}}
 * (a candidate deviation).
 */
function nativeDepthNotes(body: CharacterBody): DepthNote[] {
  return (body.prompts.depthInjections ?? [])
    .filter((d) => d.enabled !== false && d.origin !== "depth_prompt" && d.origin !== "worldinfo" && d.text.trim())
    .map((d) => ({
      text: d.text.trim(),
      depth: Number.isFinite(d.depth) ? Math.max(0, Math.min(100, Math.floor(d.depth))) : 4,
      role: d.role === "user" || d.role === "assistant" ? d.role : "system",
    }));
}

export function cardView(body: CharacterBody): CardView {
  const name = body.identity.name || "Character";
  const description = body.identity.description ?? "";
  const personality = body.persona.personality ?? "";
  const scenario = body.persona.scenario ?? "";
  const examples = body.examples.exampleMessages ?? "";
  const postHistory = body.prompts.postHistoryInstructions ?? "";
  const depthNotes = nativeDepthNotes(body);
  const stDepthPrompt = (body.prompts.depthInjections ?? []).find((d) => d.origin === "depth_prompt")?.text;
  const palette = body.presentation?.palette;
  return {
    name,
    description,
    personality,
    scenario,
    examples,
    postHistory,
    paletteTags: paletteTagLines(palette ?? [], "").join("\n"),
    depthNotes,
    macroFields: {
      charPrompt: body.prompts.systemPrompt ?? "",
      charInstruction: postHistory,
      charCreatorNotes: body.attribution.creatorNotes ?? "",
      mesExamples: examples ? [examples] : [],
      charDepthPrompt: depthNotes.length > 0 ? depthNotes.map((d) => d.text).join("\n\n") : stDepthPrompt ?? "",
      charVersion: body.identity.characterVersion ?? "",
      charCreator: body.attribution.creator ?? "",
      charTags: body.discovery.tags ?? [],
      ...(body.presentation?.signatureColor ? { characterAccentColor: body.presentation.signatureColor } : {}),
      ...(palette ? { characterPalette: palette.map((s) => ({ label: s.label ?? "", name: s.name ?? "", hex: s.hex })) } : {}),
      ...(body.presentation?.gradientColors ? { characterGradient: body.presentation.gradientColors } : {}),
    },
    characterPrompt(expand) {
      const parts = [`You are ${body.identity.name}.`];
      if (description) parts.push(`\nDescription:\n${expand(description)}`);
      if (palette?.length) {
        const colors = palette.map((s) => `${s.label ?? ""}: ${s.name ?? ""}`).join(", ");
        if (colors) parts.push(`\nAppearance: ${colors}`);
      }
      if (personality) parts.push(`\nPersonality:\n${expand(personality)}`);
      if (scenario) parts.push(`\nScenario:\n${expand(scenario)}`);
      if (examples) parts.push(`\nExample Dialogue:\n${expand(examples)}`);
      const { fullName, title, age, pronouns } = body.identity;
      const facts = [
        fullName && `Full Name: ${fullName}`,
        title && `Title: ${title}`,
        age && `Age: ${age}`,
        pronouns && `Pronouns: ${pronouns}`,
      ].filter(Boolean);
      if (facts.length > 0) parts.push(`\n${facts.join("\n")}`);
      parts.push("\nStay in character and respond as they would.");
      return parts.join("");
    },
  };
}
