/** A preset's choice groups in the assembler (RoleCall preset-loader.ts:479-520): the answers set which blocks go out, the scene's own switches win, and {{choice}} reads the answers. */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody, PresetChoice } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import type { AssemblyInput } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const block = (id: string, content: string, enabled = true) => makePresetPrompt({ id, name: id, content, systemPrompt: true, enabled });
const choices: PresetChoice[] = [
  { id: "tone", label: "Tone", type: "one", default: "dark", options: [{ id: "dark", label: "Dark", enablesPrompts: ["p-dark"] }, { id: "light", label: "Light", enablesPrompts: ["p-light"] }] },
  { id: "gore", label: "Gore", type: "toggle", options: [], default: false, extras: { prompts: ["p-gore"] } },
];
const preset: PresetBody = {
  name: "T",
  prompts: [block("main", "Be {{char}}.{{persona}}{{lore}}{{summary}} Tone={{choice::tone}} gore={{chosen::gore}}"), block("p-dark", "DARK"), block("p-light", "LIGHT", false), block("p-gore", "GORE"), block("free", "FREE")],
  choices,
};
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card, preset, history: [], current: { id: "u", role: "user", content: "Hi" },
  localVariables: new Map(), globalVariables: new Map(), now: 1, randomSeed: 1, ...over,
});
const sent = (over: Partial<AssemblyInput> = {}): string => assemble(input(over)).messages.map((m) => m.content).join("|");

describe("a preset's choices", () => {
  test("with no answer the declared defaults decide: the default option's block is on, the other option's and a toggle's are off, an unnamed block is untouched", () => {
    const out = sent();
    expect(out).toContain("DARK");
    expect(out).not.toContain("LIGHT");
    expect(out).not.toContain("GORE");
    expect(out).toContain("FREE");
  });

  test("an answer turns its option's block on and the other's off, even a block the preset ships off", () => {
    const out = sent({ choices: { tone: "light", gore: true } });
    expect(out).toContain("LIGHT");
    expect(out).not.toContain("DARK");
    expect(out).toContain("GORE");
  });

  test("an answer that is not an option falls back to the default", () => {
    expect(sent({ choices: { tone: "ghost" } })).toContain("DARK");
  });

  test("the scene's own switch wins over the choices", () => {
    const out = sent({ choices: { tone: "light" }, promptToggles: { "p-light": false, "p-dark": true } });
    expect(out).toContain("DARK");
    expect(out).not.toContain("LIGHT");
  });

  test("{{choice}} and {{chosen}} read the answers", () => {
    expect(sent({ choices: { tone: "light", gore: true } })).toContain("Tone=light gore=true");
    expect(sent()).toContain("Tone=dark gore=false");
  });

  test("a preset with no choices ignores answers", () => {
    expect(sent({ preset: { ...preset, choices: [] }, choices: { tone: "light" } })).toContain("LIGHT".slice(0, 0) + "DARK");
  });
});
