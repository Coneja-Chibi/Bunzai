/** The loadout record (studio/loadout-record.ts): checked once with the store's own validators, unknown panels kept whole. */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "./errors";
import { parseLoadoutInput, parseReceipt, type LoadoutReceipt } from "./loadout-record";

const full = {
  preset: { id: "p1", toggles: { a: true } },
  samplers: { temperature: 0.7, maxTokens: 400 },
  mainModel: { id: "c1", model: "m" },
  lorebooks: { added: ["b1"], off: ["b2"] },
  stagecraftProps: { on: ["dice"] },
  guides: ["g1", "g2"],
  authorNote: { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 },
  stageSettings: { backdrop: { pack: "k", item: "i", dim: 0.5 } },
  persona: "persona-1",
};

describe("Final Cut in a loadout", () => {
  const cut = { on: true, passes: [{ id: "post-editor", type: "editor", order: 0, failureMode: "fallback" }], tools: { custom: { maxTokens: 900 } } };
  test("is checked with the store's own validator and kept whole", () => {
    expect(parseLoadoutInput({ name: "Cut", values: { postProduction: cut } }).values).toEqual({ postProduction: cut });
    expect(parseLoadoutInput({ name: "Cut", values: { postProduction: { on: false } } }).values).toEqual({ postProduction: null });
  });
  test("a malformed Final Cut, an unknown field or a pass of an unknown type is a 400, not a stored loadout", () => {
    for (const bad of [{ on: "yes" }, { extra: 1 }, { passes: [{ id: "x", type: "nope", order: 0, failureMode: "skip" }] }, "x"]) {
      expect(() => parseLoadoutInput({ name: "Bad", values: { postProduction: bad } })).toThrow(StudioValidationError);
    }
  });
});

describe("parseLoadoutInput", () => {
  test("round trips every live panel, lists them in RoleCall's order, and trims the name", () => {
    const parsed = parseLoadoutInput({ name: "  Slow burn ", values: full });
    expect(parsed.name).toBe("Slow burn");
    expect(parsed.values).toEqual(full);
    expect(parsed.panels).toEqual(["preset", "persona", "mainModel", "samplers", "lorebooks", "stageSettings", "stagecraftProps", "authorNote", "guides"]);
  });

  test("null is legal for every live panel and means clear it", () => {
    const values = Object.fromEntries(Object.keys(full).map((k) => [k, null]));
    expect(parseLoadoutInput({ name: "Blank", values }).values).toEqual(values);
  });

  test("a panel this build does not know, a later one and a struck one are kept verbatim after the known ones", () => {
    const odd = { name: "Future", values: { zebra: { deep: [1, { x: null }] }, dm: { mode: "x" }, characterVoices: "v", persona: null } };
    const parsed = parseLoadoutInput(odd);
    expect(parsed.values).toEqual(odd.values);
    expect(parsed.panels).toEqual(["persona", "dm", "characterVoices", "zebra"]);
  });

  test("every known panel is checked by the store's own rule, and the refusal names the panel", () => {
    const bad: [string, unknown][] = [
      ["preset", { id: "", toggles: {} }],
      ["preset", { id: "p", toggles: {}, samplers: {} }],
      ["samplers", { temperature: "hot" }],
      ["samplers", { nope: 1 }],
      ["mainModel", { id: "c" }],
      ["lorebooks", { added: ["a", "a"], off: [] }],
      ["stagecraftProps", { on: ["Bad Id"] }],
      ["guides", ["ok", 3]],
      ["guides", "g1"],
      ["authorNote", { text: "x", position: "sideways", depth: 1, frequency: 1 }],
      ["stageSettings", { backdrop: { pack: "k" } }],
      ["stageSettings", {}],
      ["persona", ""],
      ["persona", 4],
    ];
    for (const [panel, value] of bad) {
      const run = () => parseLoadoutInput({ name: "x", values: { [panel]: value } });
      expect(run).toThrow(StudioValidationError);
      expect(run).toThrow(panel);
    }
  });

  test("the name is 1 to 40 characters after trimming, and the shape is exact", () => {
    const bad: unknown[] = [
      { name: "  ", values: {} },
      { name: "x".repeat(41), values: {} },
      { name: 3, values: {} },
      { name: "x" },
      { name: "x", values: [] },
      { name: "x", values: {}, panels: [] },
      { name: "x", values: { ["k".repeat(65)]: 1 } },
      { name: "x", values: { zebra: "z".repeat(70_000) } },
      "x",
      null,
    ];
    for (const raw of bad) expect(() => parseLoadoutInput(raw)).toThrow(StudioValidationError);
    expect(parseLoadoutInput({ name: "x".repeat(40), values: {} }).panels).toEqual([]);
  });

  test("more than 64 panels are refused", () => {
    const values = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]));
    expect(() => parseLoadoutInput({ name: "x", values })).toThrow(StudioValidationError);
  });
});

describe("parseReceipt", () => {
  const receipt: LoadoutReceipt = {
    code: "LD-0a1b2c3d", chatId: "c", loadoutId: "l", loadoutName: "Slow burn", appliedAt: 1, undoUntil: 2,
    rows: [{ unit: "lore", panels: ["lorebooks"], state: "applied" }, { unit: "note", panels: ["authorNote"], state: "failed", error: "no" }],
    before: { lore: null, note: null }, after: { lore: { added: ["b"], off: [] }, note: { text: "x" } },
  };
  test("a good receipt round trips, with or without an undone time", () => {
    expect(parseReceipt(receipt)).toEqual(receipt);
    expect(parseReceipt({ ...receipt, undoneAt: 5 })).toEqual({ ...receipt, undoneAt: 5 });
  });
  test("anything else is refused", () => {
    const bad: unknown[] = [
      { ...receipt, code: "" },
      { ...receipt, extra: 1 },
      { ...receipt, appliedAt: "1" },
      { ...receipt, rows: [{ unit: "zzz", panels: [], state: "applied" }] },
      { ...receipt, rows: [{ unit: "lore", panels: [], state: "done" }] },
      { ...receipt, before: { lore: null, nope: 1 } },
      { ...receipt, after: [] },
      { ...receipt, before: { lore: "x".repeat(300_000) } },
      "x",
    ];
    for (const raw of bad) expect(() => parseReceipt(raw)).toThrow(StudioValidationError);
  });
});
