/**
 * The Cast wing's Live Preview: the persona block assemble() itself sends for a draft persona, so the preview can
 * never drift from the request. It runs the assembler on the scene's frozen card with no preset (the default layout seats
 * the persona as its own block, `personaDescription`), so preset text never lands inside what it shows.
 */
import type { CharacterBody } from "../../entities/character/schema";
import type { PersonaBody } from "../../entities/persona/schema";
import { assemble } from "./assemble";

/** The persona's text exactly as the model reads it: wrapper, XML and macros expanded; empty when no block carries it. */
export function personaBlock(persona: PersonaBody, character: CharacterBody, now: number): string {
  const out = assemble({
    character, persona, history: [], current: { id: "preview", role: "user", content: "" },
    localVariables: new Map(), globalVariables: new Map(), now, randomSeed: 1,
  });
  const at = out.trace.findIndex((t) => t.source.kind === "prompt" && (t.source.id === "personaInjected" || t.source.id === "personaDescription"));
  return at < 0 ? "" : out.messages[at]!.content;
}
