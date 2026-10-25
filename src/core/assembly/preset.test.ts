/**
 * A preset laid out for a turn (RoleCall's `loadPresetPrompts`, preset-loader.ts at the pin): which
 * blocks are on, where each placement goes, and the missing slots RoleCall fills in so an imported
 * SillyTavern preset still sends the card, the persona, the lore, and the history.
 */
import { describe, expect, test } from "bun:test";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { presetPlan, PresetPlanError } from "./preset";

const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt =>
  makePresetPrompt({ id, name: id, content, systemPrompt: true, ...over });
const marker = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => block(id, "", { marker: true, markerSlot: id, ...over });
const preset = (prompts: PresetPrompt[]): PresetBody => ({ name: "Test", prompts });
const texts = (blocks: readonly { content: string }[]) => blocks.map((b) => b.content);

describe("which blocks are on", () => {
  test("a disabled block, an empty non-marker block, and a repeated id are left out; empty markers stay as anchors", () => {
    const plan = presetPlan(preset([
      block("main", "Be {{char}}."),
      block("off", "Never sent.", { enabled: false }),
      block("blank", "   "),
      block("main", "A second main."),
      marker("chatHistory"),
      block("persona", "{{persona}}"),
      block("lore", "{{lore}}"),
      block("sum", "{{summary}}"),
    ]));
    expect(texts(plan.relative)).toEqual(["Be {{char}}.", "{{message_history}}", "{{persona}}", "{{lore}}", "{{summary}}"]);
  });

  test("the scene's toggles win over the preset's own switch, both ways, keyed by block id", () => {
    const plan = presetPlan(
      preset([block("a", "A {{persona}} {{lore}} {{summary}} {{message_history}}"), block("b", "B", { enabled: false }), block("c", "C")]),
      { b: true, c: false },
    );
    expect(texts(plan.relative)).toEqual(["A {{persona}} {{lore}} {{summary}} {{message_history}}", "B"]);
  });

  test("forbidOverrides does not lock the scene's own toggle (RoleCall VVS-532)", () => {
    const plan = presetPlan(preset([block("a", "{{persona}}{{lore}}{{summary}}{{message_history}}"), block("b", "B", { forbidOverrides: true })]), { b: false });
    expect(texts(plan.relative)).not.toContain("B");
  });
});

describe("where each placement goes", () => {
  const all = "{{persona}}{{lore}}{{summary}}{{message_history}}";
  test("relative blocks keep the preset's order, whatever their injection order says", () => {
    const plan = presetPlan(preset([block("x", all, { injectionOrder: 900 }), block("y", "Y", { injectionOrder: 1 })]));
    expect(texts(plan.relative)).toEqual([all, "Y"]);
  });

  test("a placement it does not know, or a tool-role block, stops the turn with the block's name instead of vanishing", () => {
    expect(() => presetPlan(preset([block("odd", "x", { placement: "sideways" })]))).toThrow(PresetPlanError);
    expect(() => presetPlan(preset([block("odd", "x", { placement: "sideways" })]))).toThrow(/odd/);
    expect(() => presetPlan(preset([block("tool-call", "x", { name: "Hand-off", role: "tool" })]))).toThrow(/Hand-off/);
  });

  test("each block carries its name for the trace", () => {
    const plan = presetPlan(preset([block("main", all, { name: "Main Prompt" })]));
    expect(plan.relative[0]!.source).toEqual({ kind: "prompt", name: "Main Prompt", id: "main" });
  });
});

describe("the slots RoleCall fills in", () => {
  test("a standard SillyTavern preset: empty card markers get their macros, and lore, persona, summary, history land in their slots", () => {
    const plan = presetPlan(preset([
      block("main", "Write as {{char}}."),
      marker("worldInfoBefore"),
      marker("personaDescription"),
      marker("charDescription"),
      marker("charPersonality"),
      marker("scenario"),
      marker("worldInfoAfter"),
      marker("dialogueExamples"),
      marker("chatHistory"),
      block("jailbreak", "Stay in character."),
    ]));
    expect(texts(plan.relative)).toEqual([
      "Write as {{char}}.",
      "",
      "{{lore}}",
      "{{persona}}",
      "{{description}}",
      "{{personality}}",
      "{{scenario}}",
      "",
      "{{mesExamples}}",
      "{{summary}}",
      "{{message_history}}",
      "Stay in character.",
    ]);
  });

  test("without world info markers the lore goes just before the history; without a persona marker the persona follows main", () => {
    const plan = presetPlan(preset([block("main", "Main."), block("x", "X"), marker("chatHistory")]));
    expect(texts(plan.relative)).toEqual(["Main.", "{{persona}}", "X", "{{lore}}", "{{summary}}", "{{message_history}}"]);
  });

  test("a marker with text of its own keeps it, with the macro added after", () => {
    const plan = presetPlan(preset([block("personaDescription", "About you:", { marker: true }), block("chatHistory", "The story so far:", { marker: true })]));
    expect(texts(plan.relative)).toContain("About you:\n\n{{persona}}");
    expect(texts(plan.relative)).toContain("The story so far:\n\n{{message_history}}");
  });

  test("with no history slot at all, the history becomes an in-chat block at depth 0", () => {
    const plan = presetPlan(preset([block("main", "Main.")]));
    expect(texts(plan.inChat.get(0)!)).toEqual(["{{message_history}}"]);
    expect(texts(plan.relative)).toEqual(["{{lore}}", "Main.", "{{persona}}", "{{summary}}"]);
  });

  test("the lore slot follows worldInfoBefore's own placement when that marker sits in the chat", () => {
    const plan = presetPlan(preset([
      block("main", "{{persona}}{{summary}}{{message_history}}"),
      marker("worldInfoBefore", { placement: "in_chat", injectionDepth: 3, injectionOrder: 5 }),
    ]));
    expect(texts(plan.inChat.get(3)!)).toEqual(["", "{{lore}}"]);
  });

  test("a macro already present anywhere means no slot is added for it", () => {
    const plan = presetPlan(preset([block("all", "{{lore}} {{persona}} {{ summary }} {{MESSAGE_HISTORY}}")]));
    expect(texts(plan.relative)).toEqual(["{{lore}} {{persona}} {{ summary }} {{MESSAGE_HISTORY}}"]);
    expect(plan.inChat.size).toBe(0);
  });

  test("the preset itself is never changed", () => {
    const body = preset([marker("personaDescription"), marker("chatHistory")]);
    const before = JSON.stringify(body);
    presetPlan(body);
    expect(JSON.stringify(body)).toBe(before);
  });
});
