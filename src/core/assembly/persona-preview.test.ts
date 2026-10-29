/**
 * The Cast wing's persona preview and the preset scan, proved against the assembler itself: the preview is the persona
 * block assemble() sends, the wrapper reaches the request, the stored position moves it only as persona-position.test.ts proves (RoleCall's assembler ignores the stop,
 * prompt-assembly.ts:1874-1890 only prepends injection_prefix; Bunzai honours what the Persona tab promises), and the scan names the block that already carries {{persona}} the way fillSlots counts it.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { emptyPersonaBody } from "../../entities/persona";
import type { PersonaBody } from "../../entities/persona/schema";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import { personaBlock } from "./persona-preview";
import { personaMacroBlock } from "./preset";
import type { AssemblyInput } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as unknown as CharacterBody;
const persona = (over: Partial<PersonaBody> = {}): PersonaBody => ({
  ...emptyPersonaBody("Boo"), sections: { personality: "I am {{user}}, met by {{char}}." }, traits: ["curious"], ...over,
});
const turn = (p: PersonaBody, preset?: PresetBody): AssemblyInput => ({
  character: card, persona: p, ...(preset ? { preset } : {}), history: [], current: { id: "u", role: "user", content: "Hi" },
  localVariables: new Map(), globalVariables: new Map(), now: 0, randomSeed: 1,
});
const personaMessage = (input: AssemblyInput): string => {
  const out = assemble(input);
  return out.messages[out.trace.findIndex((t) => t.source.kind === "prompt" && t.source.id === "personaDescription")]!.content;
};
const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt => makePresetPrompt({ id, name: id, content, ...over });

describe("the preview is what the assembler sends", () => {
  test("it equals the persona block of the request, macros expanded", () => {
    const p = persona();
    expect(personaBlock(p, card, 0)).toBe(personaMessage(turn(p)));
    expect(personaBlock(p, card, 0)).toContain("I am Boo, met by Vera.");
  });

  test("the wrapper text reaches the request, on its own line above the persona, macros expanded", () => {
    const p = persona({ chatInjection: { position: "character", wrapper: "This is {{user}}'s identity:" } });
    const sent = personaMessage(turn(p));
    expect(sent.split("\n")[0]).toBe("This is Boo's identity:");
    expect(personaBlock(p, card, 0)).toBe(sent);
  });
});

describe("which preset block carries {{persona}}", () => {
  const preset = (prompts: PresetPrompt[]): PresetBody => ({ name: "P", prompts });

  test("names the first block that is on and holds the macro", () => {
    expect(personaMacroBlock(preset([block("main", "Be kind."), block("who", "Player: {{persona}}")]), {})).toEqual({ id: "who", name: "who" });
  });

  test("a switched-off block does not count, by the preset's switch or the scene's toggle: the assembler adds its own", () => {
    expect(personaMacroBlock(preset([block("main", "Be kind."), block("who", "{{persona}}", { enabled: false })]), {})).toBeNull();
    expect(personaMacroBlock(preset([block("who", "{{persona}}")]), { who: false })).toBeNull();
    expect(personaMacroBlock(preset([block("who", "{{persona}}", { enabled: false })]), { who: true })).toEqual({ id: "who", name: "who" });
  });

  test("agrees with the assembler: when the scan finds none, the request still carries the persona once", () => {
    const p = preset([block("main", "Be kind.")]);
    expect(personaMacroBlock(p, {})).toBeNull();
    expect(assemble(turn(persona(), p)).messages.filter((m) => m.content.includes("<persona name=\"Boo\">"))).toHaveLength(1);
  });

  test("a preset the assembler cannot lay out reads as none", () => {
    expect(personaMacroBlock(preset([block("who", "{{persona}}", { role: "tool" })]), {})).toBeNull();
  });
});
