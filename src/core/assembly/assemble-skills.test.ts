/**
 * Skills in the request (skills.ts): the ones on this turn as one "### Skills" system block, after the leading system messages
 * or at the preset's skills marker, their macros rendered, reserved by the budget, with each skill's verdict on the result.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { emptySkillBody, type SkillBody } from "../../entities/skill/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import type { AssemblySkill } from "./skills";
import type { AssemblyInput, Budgeter, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "I draw my sword."),
  localVariables: new Map(), globalVariables: new Map(), now: Date.UTC(2026, 9, 29), randomSeed: 1,
  ...over,
});
const lines = (over: Partial<AssemblyInput>) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
const skill = (id: string, over: Partial<SkillBody> = {}, open = false): AssemblySkill =>
  ({ id, open, body: { ...emptySkillBody(id), text: `${id} text`, triggers: [{ keyword: "sword", isRegex: false }], ...over } });
const BASE = ["system:Keeps the light.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:I draw my sword."];

describe("the Skills block", () => {
  test("a mentioned skill rides as one system block after the leading system messages; one not mentioned adds nothing", () => {
    const skills = [skill("Sword fight"), skill("Haggling", { triggers: [{ keyword: "coin", isRegex: false }] })];
    expect(lines({ skills })).toEqual(["system:Keeps the light.", "system:### Skills\n\n## Sword fight\nSword fight text", ...BASE.slice(1)]);
  });

  test("an always skill and an open picked one join it, in the scene's order; a closed picked one does not", () => {
    const skills = [skill("A", { when: "always" }), skill("B", { when: "picked" }), skill("C", { when: "picked" }, true)];
    expect(lines({ skills })[1]).toBe("system:### Skills\n\n## A\nA text\n\n## C\nC text");
  });

  test("its text renders the turn's macros", () => {
    expect(lines({ skills: [skill("S", { text: "Guard {{char}}." })] })[1]).toBe("system:### Skills\n\n## S\nGuard Vera.");
  });

  test("a macro nothing answers is stripped, as in the preset's blocks", () => {
    expect(lines({ skills: [skill("S", { text: "Hi {{char}} {{nonexistentmacro}}" })] })[1]).toBe("system:### Skills\n\n## S\nHi Vera");
  });

  test("no skill on, or only blank ones, adds nothing", () => {
    expect(lines({ skills: [skill("S", { when: "picked" })] })).toEqual(BASE);
    expect(lines({ skills: [skill("S", { text: "  " })] })).toEqual(BASE);
  });

  test("it goes where the preset's skills marker stands", () => {
    const main = makePresetPrompt({ id: "main", name: "main", content: "Be {{char}}.{{persona}}{{lore}}{{summary}}", systemPrompt: true });
    const mark = makePresetPrompt({ id: "skills", name: "Skills", content: "", marker: true, markerSlot: "skills", placement: "in_chat", injectionDepth: 1, role: "system" });
    expect(lines({ preset: { name: "P", prompts: [main, mark] }, skills: [skill("S")] })).toEqual([
      "system:Be Vera.", "assistant:Evening.", "user:Hi", "system:### Skills\n\n## S\nS text", "assistant:Hello.", "user:I draw my sword.",
    ]);
  });

  test("each linked skill's verdict is on the result, and the block is traced as its own source", () => {
    const result = assemble(input({ skills: [skill("S"), skill("P", { when: "picked" })] }));
    expect(result.skills).toEqual([{ id: "S", name: "S", on: true, why: "Mentioned: sword." }, { id: "P", name: "P", on: false, why: "Not opened." }]);
    expect(result.trace[1]?.source.kind).toBe("skills");
  });
});

describe("the budget", () => {
  test("reserves the Skills block like the trackers' block: history gives way to it, it is never dropped", () => {
    const seen: { fit?: readonly unknown[]; final?: string[] } = {};
    const budgeter: Budgeter = {
      name: "app",
      fitHistory: (i) => { seen.fit = i.important; return i.history.length; },
      finalPass: (messages, _cap, droppable) => { seen.final = messages.filter((_, i) => !droppable[i]).map((m) => m.content); return { keep: messages.map(() => true), dropped: 0 }; },
    };
    const result = assemble(input({ skills: [skill("S")], budgeter, window: { context: 8000, reply: 500 } }));
    expect(seen.fit).toContain("### Skills\n\n## S\nS text");
    expect(seen.final).toContain("### Skills\n\n## S\nS text");
    expect(result.budget.fixed).toBe(true);
  });
});
