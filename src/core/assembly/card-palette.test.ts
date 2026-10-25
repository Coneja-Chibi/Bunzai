/**
 * The Character tab's named colors (Hair, Eyes, Skin) reach the request two ways. As XML tags, the form a persona's go in, with the
 * description (persona-position.test.ts proves the tags); and through the {{palette}} macro (macros handlers/character.ts:266, fed by
 * prompt-assembly.ts:1646), RoleCall's only route, which then replaces the tags so a preset that names it is not told twice.
 * RoleCall's "Appearance: Hair: Silver" line (prompt-assembly.ts:3200) is built but its default prompt never sends it.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { assemble } from "./assemble";
import type { AssemblyInput } from "./types";

const card = (palette?: { label?: string; name?: string; hex: string }[]): CharacterBody =>
  ({
    identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {},
    discovery: {}, ...(palette ? { presentation: { palette } } : {}),
  }) as CharacterBody;

const ask = (character: CharacterBody, text: string): string => {
  const input: AssemblyInput = {
    character, history: [], current: { id: "u1", role: "user", content: text },
    localVariables: new Map(), globalVariables: new Map(), now: Date.UTC(2026, 8, 27), randomSeed: 1,
  };
  return assemble(input).messages.map((m) => m.content).join("\n");
};

describe("named colors in the request", () => {
  const palette = [{ label: "Hair", name: "Silver", hex: "#d9c8ff" }, { label: "Eyes", name: "Violet", hex: "#6366f1" }];

  test("a turn that does not name {{palette}} sends the colors as tags, never as RoleCall's unsent Appearance line", () => {
    const sent = ask(card(palette), "hello");
    expect(sent).toContain("<hair>Silver (#d9c8ff)</hair>");
    expect(sent).not.toContain("Appearance:");
  });

  test("{{palette}} is the label, name and hex rows as JSON", () => {
    expect(ask(card(palette), "{{palette}}")).toContain(JSON.stringify(palette));
  });

  test("a card with no named colors gives an empty palette", () => {
    expect(ask(card(), "{{palette}}")).toContain("[]");
  });
});
