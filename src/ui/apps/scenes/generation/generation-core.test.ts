/** The Generation tab's pure rules (generation-core.ts): search, the Core cards' effective values, and Reset. */
import { describe, expect, test } from "bun:test";
import type { ChatPreset } from "../../../../stage/contracts/chat-store";
import { PARAMS } from "../../../../stage/params";
import { coreChangedCount, coreValue, matchParams, resetCore } from "./generation-core";

const own = (samplers: ChatPreset["samplers"]): ChatPreset => ({ kind: "preset", id: "p", toggles: { a: true }, samplers });

describe("matchParams", () => {
  test("finds by id, label, description and alias, and returns all of them for a blank query", () => {
    expect(matchParams(PARAMS, "  ").length).toBe(PARAMS.length);
    expect(matchParams(PARAMS, "TOP_K").map((p) => p.id)).toContain("top_k");
    expect(matchParams(PARAMS, "max reply").map((p) => p.id)).toEqual(["max_tokens"]);
    expect(matchParams(PARAMS, "adventurous").map((p) => p.id)).toEqual(["temperature"]);
    expect(matchParams([{ ...PARAMS[0]!, id: "typical_p", aliases: ["locally_typical"] }], "locally_typ").map((p) => p.id)).toEqual(["typical_p"]);
  });
});

describe("Core values", () => {
  const temperature = PARAMS.find((p) => p.id === "temperature")!;
  test("the scene's own value wins, then the preset's, else nothing is set", () => {
    expect(coreValue(temperature, own({ temperature: 1.3 }), { temperature: 0.7 })).toEqual({ value: 1.3, from: "scene" });
    expect(coreValue(temperature, own({}), { temperature: 0.7 })).toEqual({ value: 0.7, from: "preset" });
    expect(coreValue(temperature, own({}), {})).toEqual({ value: undefined, from: "unset" });
  });
  test("only the four Core fields count as changed for this chat", () => {
    expect(coreChangedCount(own({ temperature: 1, topK: 40, maxContext: 9000, frequencyPenalty: 0.5 }))).toBe(2);
  });
});

describe("Reset", () => {
  test("clears the Core overrides back to the preset and keeps every other scene setting", () => {
    const next = resetCore(own({ temperature: 1, topP: 0.5, topK: 40, maxTokens: 900, maxContext: 9000, frequencyPenalty: 0.5 }));
    expect(next).toEqual({ kind: "preset", id: "p", toggles: { a: true }, samplers: { maxContext: 9000, frequencyPenalty: 0.5 } });
  });
});
