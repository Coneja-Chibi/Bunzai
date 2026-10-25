/**
 * The persona's stored Prompt Injection stop and depth, and the character's named colors, in the request the assembler builds.
 * World pins the persona to the start, Scene seats it after the scenario, Depth weaves it into the history like a depth note; unset
 * (or Character) is the assembler's own persona block, as before. A preset block that already carries {{persona}} wins, which is
 * why the Persona tab locks the stops then. The character's colors ride as the same XML tags a persona's do.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { emptyPersonaBody } from "../../entities/persona";
import type { PersonaBody } from "../../entities/persona/schema";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { injectPersonaXml, paletteTagLines } from "../persona/inject";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import { personaBlock } from "./persona-preview";
import type { AssemblyInput } from "./types";

const palette = [{ label: "Hair", name: "Silver", hex: "#d9c8ff" }, { label: "Eyes", name: "Violet", hex: "#6366f1" }];
const card = (withPalette = false): CharacterBody =>
  ({
    identity: { name: "Vera", description: "Keeps the light." }, persona: { scenario: "At the lighthouse." }, prompts: {}, greetings: {}, examples: {}, media: {},
    attribution: {}, discovery: {}, ...(withPalette ? { presentation: { palette } } : {}),
  }) as unknown as CharacterBody;
const persona = (over: Partial<PersonaBody> = {}): PersonaBody => ({ ...emptyPersonaBody("Boo"), sections: { personality: "Curious." }, ...over });
const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt => makePresetPrompt({ id, name: id, content, ...over });
const layout: PresetBody = { name: "P", prompts: [block("main", "Be kind."), block("charDescription", "{{description}}"), block("scenario", "{{scenario}}"), block("h", "{{message_history}}")] };
const history = [
  { id: "h1", role: "assistant" as const, content: "Welcome." }, { id: "h2", role: "user" as const, content: "Hi." },
  { id: "h3", role: "assistant" as const, content: "Hello." }, { id: "h4", role: "user" as const, content: "Again." },
];
const turn = (p: PersonaBody, over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card(), persona: p, history, current: { id: "u", role: "user", content: "Now" },
  localVariables: new Map(), globalVariables: new Map(), now: 0, randomSeed: 1, ...over,
});
const texts = (input: AssemblyInput): string[] => assemble(input).messages.map((m) => m.content);
const personaAt = (input: AssemblyInput): number => texts(input).findIndex((t) => t.includes('<persona name="Boo">'));
const at = (chatInjection: PersonaBody["chatInjection"]) => persona({ chatInjection });

describe("the persona's stop and depth", () => {
  test("World seats the persona first, in front of the preset's own blocks", () => {
    expect(personaAt(turn(at({ position: "world" }), { preset: layout }))).toBe(0);
    expect(personaAt(turn(persona(), { preset: layout }))).toBe(1);
  });

  test("Scene seats it straight after the scenario block", () => {
    const input = turn(at({ position: "scene" }), { preset: layout });
    expect(personaAt(input)).toBe(texts(input).indexOf("At the lighthouse.") + 1);
    expect(personaAt(turn(persona(), { preset: layout }))).toBe(1);
  });

  test("Depth weaves it before the message that many back, as a system message unless a role is set", () => {
    const shown = (depth: number, role?: "user" | "assistant") => {
      const input = turn(at({ position: "depth", depth, ...(role ? { role } : {}) }), { preset: layout });
      const out = assemble(input).messages;
      const i = personaAt(input);
      return { next: out[i + 1]?.content, role: out[i]?.role };
    };
    expect(shown(0)).toEqual({ next: "Now", role: "system" });
    expect(shown(2)).toEqual({ next: "Hello.", role: "system" });
    expect(shown(1, "user").role).toBe("user");
  });

  test("a depth past the history lands before its first message; an unset depth is 2", () => {
    const input = turn(at({ position: "depth", depth: 40 }), { preset: layout });
    expect(texts(input)[personaAt(input) + 1]).toBe("Welcome.");
    const unset = turn(at({ position: "depth" }), { preset: layout });
    expect(texts(unset)[personaAt(unset) + 1]).toBe("Hello.");
  });

  test("a moved persona is sent once, and the trace names it", () => {
    for (const chatInjection of [{ position: "world" }, { position: "scene" }, { position: "depth", depth: 1 }] as const) {
      const out = assemble(turn(at(chatInjection), { preset: layout }));
      expect(out.messages.filter((m) => m.content.includes('<persona name="Boo">'))).toHaveLength(1);
      expect(out.trace.filter((t) => t.source.kind === "prompt" && t.source.id === "personaInjected")).toHaveLength(1);
    }
  });

  test("unset, Character, and the stops this version does not move send the same request", () => {
    for (const preset of [undefined, layout]) {
      const base = assemble(turn(persona(), preset ? { preset } : {})).messages;
      for (const chatInjection of [{ position: "character" }, { position: "prompt" }, { position: "none" }, { position: "in_chat", depth: 3 }] as const) {
        expect(assemble(turn(at(chatInjection), preset ? { preset } : {})).messages).toEqual(base);
      }
    }
  });

  test("a preset block that already carries {{persona}} decides, and the stop moves nothing", () => {
    const own: PresetBody = { name: "P", prompts: [block("main", "Be kind."), block("who", "Player: {{persona}}"), block("h", "{{message_history}}")] };
    const base = assemble(turn(persona(), { preset: own })).messages;
    for (const chatInjection of [{ position: "world" }, { position: "scene" }, { position: "depth", depth: 0 }] as const) {
      expect(assemble(turn(at(chatInjection), { preset: own })).messages).toEqual(base);
    }
  });

  test("the wrapper rides with the moved persona", () => {
    const input = turn(at({ position: "world", wrapper: "This is {{user}}:" }), { preset: layout });
    expect(texts(input)[0]!.split("\n")[0]).toBe("This is Boo:");
  });

  test("the Live Preview is the persona block of the request at every stop", () => {
    for (const chatInjection of [undefined, { position: "world" }, { position: "scene" }, { position: "depth", depth: 3 }] as const) {
      const p = at(chatInjection);
      const input = turn(p, { history: [] });
      expect(personaBlock(p, card(), 0)).toBe(texts(input)[personaAt(input)] as string);
      expect(personaBlock(p, card(), 0)).toContain('<persona name="Boo">');
    }
  });
});

describe("the character's named colors as XML tags", () => {
  const sent = (character: CharacterBody, preset?: PresetBody) => texts(turn(persona(), { character, ...(preset ? { preset } : {}) }));

  test("ride in the character's description block, in the persona's tag form", () => {
    const lines = paletteTagLines(palette, "").join("\n");
    expect(lines).toBe("<hair>Silver (#d9c8ff)</hair>\n<eyes>Violet (#6366f1)</eyes>");
    for (const out of [sent(card(true)), sent(card(true), layout)]) expect(out).toContain(`Keeps the light.\n${lines}`);
    const asPersona = { ...persona(), presentation: { colors: palette } } as PersonaBody;
    expect(injectPersonaXml(asPersona)).toContain(paletteTagLines(palette, "  ").join("\n"));
  });

  test("a card with no named colors sends none, and one with no description still sends them", () => {
    expect(sent(card()).join("\n")).not.toContain("<hair>");
    const bare = { ...card(true), identity: { name: "Vera" } } as unknown as CharacterBody;
    expect(sent(bare, layout)).toContain("<hair>Silver (#d9c8ff)</hair>\n<eyes>Violet (#6366f1)</eyes>");
  });

  test("a preset that names {{palette}} gets the JSON and no tags", () => {
    const named: PresetBody = { name: "P", prompts: [...layout.prompts, block("pal", "Colors: {{palette}}")] };
    const out = sent(card(true), named).join("\n");
    expect(out).toContain(JSON.stringify(palette));
    expect(out).not.toContain("<hair>");
  });

  test("a label with no tag name or a color with no name is left out, as for a persona", () => {
    const odd = { ...card(), presentation: { palette: [{ label: "!!", name: "X", hex: "#fff" }, { label: "Skin", hex: "#fee" }, { label: "Lips", name: "Rose" }] } } as unknown as CharacterBody;
    expect(sent(odd).join("\n")).toContain("<lips>Rose</lips>");
    expect(sent(odd).join("\n")).not.toMatch(/<skin>|<>/);
  });
});
