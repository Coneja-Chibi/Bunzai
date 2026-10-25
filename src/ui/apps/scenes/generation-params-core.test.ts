/** What a Generation card shows and what changing it writes; the scene keeps only what differs. */
import { describe, expect, test } from "bun:test";
import { paramById, PARAMS, paramsIn } from "../../../stage/params";
import { cardState, enabledCount, parentOn, setCard, withCustom , groupsEnabled, resetParams } from "./generation-params-core";

const def = (id: string) => paramById(id)!;

describe("group counts (RoleCall's N/M enabled)", () => {
  test("no parameter sits in two of the four groups, and each is a real parameter", () => {
    const ids = ["nucleus", "penalties", "constraints", "advanced"].flatMap((g) => paramsIn(g as never).map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !PARAMS.some((p) => p.id === id))).toEqual([]);
  });
  test("counts the cards that are on, from the scene or inherited from the preset", () => {
    const nucleus = paramsIn("nucleus");
    expect(enabledCount(nucleus, undefined, {})).toBe(0);
    expect(enabledCount(nucleus, { tfs: { on: true }, top_a: { on: false } }, { minP: 0.05, topA: 0.1 })).toBe(2);
  });
});

describe("cardState", () => {
  test("a card the scene never touched is off, at the registry's default", () => {
    expect(cardState(def("tfs"), undefined, {})).toEqual({ on: false, value: 1 });
  });
  test("a typed preset value that does something shows as on; a no-op one does not", () => {
    expect(cardState(def("min_p"), undefined, { minP: 0.2 })).toEqual({ on: true, value: 0.2 });
    expect(cardState(def("min_p"), undefined, { minP: 0 })).toEqual({ on: false, value: 0.05 });
    expect(cardState(def("repetition_penalty"), undefined, { repetitionPenalty: 1 }).on).toBe(false);
  });
  test("the scene's own entry wins over the preset's", () => {
    expect(cardState(def("min_p"), { min_p: { on: false, value: 0.3 } }, { minP: 0.2 })).toEqual({ on: false, value: 0.3 });
  });
});

describe("setCard", () => {
  test("switching on writes the entry, and a boolean sends true", () => {
    expect(setCard(def("tfs"), undefined, {}, { on: true })).toEqual({ tfs: { on: true } });
    expect(setCard(def("early_stopping"), undefined, {}, { on: true })).toEqual({ early_stopping: { on: true, value: true } });
  });
  test("switching off a card with nothing to remember removes the entry", () => {
    expect(setCard(def("tfs"), { tfs: { on: true } }, {}, { on: false })).toEqual({});
  });
  test("switching off keeps a value the person set", () => {
    expect(setCard(def("tfs"), { tfs: { on: true, value: 1.5 } }, {}, { on: false })).toEqual({ tfs: { on: false, value: 1.5 } });
  });
  test("switching off a value the preset supplies writes an explicit off", () => {
    expect(setCard(def("min_p"), undefined, { minP: 0.2 }, { on: false })).toEqual({ min_p: { on: false } });
  });
  test("a value change keeps the card on", () => {
    expect(setCard(def("tfs"), { tfs: { on: true } }, {}, { value: 1.2 })).toEqual({ tfs: { on: true, value: 1.2 } });
  });
  test("other cards are left alone", () => {
    expect(setCard(def("tfs"), { seed: { on: true, value: 3 } }, {}, { on: true })).toEqual({ seed: { on: true, value: 3 }, tfs: { on: true } });
  });
});

describe("parentOn and withCustom", () => {
  test("a sub-toggle is greyed while its parent is off", () => {
    expect(parentOn(def("clear_thinking"), undefined, {}, PARAMS)).toBe(false);
    expect(parentOn(def("clear_thinking"), { enable_thinking: { on: true } }, {}, PARAMS)).toBe(true);
    expect(parentOn(def("tfs"), undefined, {}, PARAMS)).toBe(true);
  });
  test("custom text is set, and blank text removes the field", () => {
    expect(withCustom({ customBody: "{}" } as Record<string, string>, "customBody", " ")).toEqual({});
    expect(withCustom({ temperature: 1 } as Record<string, unknown>, "customBody", "x")).toEqual({ temperature: 1, customBody: "x" });
  });
});

describe("Reset", () => {
  test("clears every parameter the scene switched on, including the typed ones, and leaves the Core values, the merge mode and the custom text", () => {
    const next = resetParams({ temperature: 1, minP: 0.1, topA: 0.2, frequencyPenalty: 0.5, presencePenalty: 0.5, repetitionPenalty: 1.1, promptPostProcessing: "merge", params: { seed: { on: true, value: 3 } }, customBody: "a: 1" });
    expect(next).toEqual({ temperature: 1, promptPostProcessing: "merge", customBody: "a: 1" });
  });
});

describe("the count a group reports to the tab", () => {
  test("is every switched-on card across the four groups", () => {
    expect(groupsEnabled({ seed: { on: true }, n: { on: false } }, {})).toBe(1);
    expect(groupsEnabled(undefined, {})).toBe(0);
  });
});
