/**
 * What the Trackers panel decides before it draws a library tracker, with no render: how each field type shows, what a card leaves out, item tiles with a count, the sentence a reply's change
 * reads as, a piece's shape line and the link list after a check.
 */
import { describe, expect, test } from "bun:test";
import type { TrackerBody, TrackerField } from "../../../../../../entities/tracker/schema";
import { cardFields, changeSentence, fieldView, fillOf, itemTiles, shapeOf, shapeText, draggable, toggleLinked, topOf } from "./library-core";

const hp: TrackerField = { name: "hp", description: "", type: "number", min: 0, maxField: "hp_max", icon: "lucide:activity" };
const hpMax: TrackerField = { name: "hp_max", description: "", type: "number", min: 1 };
const body = (fields: TrackerField[], over: Partial<TrackerBody> = {}): TrackerBody => ({ name: "T", description: "", layout: "record", note: "", fields, ...over });

describe("how a field shows", () => {
  test("a number with a top is a bar, whether the top is another field or its own max", () => {
    expect(fieldView(hp, { hp: 7, hp_max: 20 })).toEqual({ name: "hp", icon: "lucide:activity", kind: "bar", value: 7, top: 20, fill: 0.35 });
    expect(fieldView({ name: "mana", description: "", type: "number", max: 10 }, { mana: 5 })).toMatchObject({ kind: "bar", top: 10, fill: 0.5 });
  });

  test("an open number is the number, and a bar whose top field holds no number falls back to the number", () => {
    expect(fieldView({ name: "gold", description: "", type: "number" }, { gold: 212 })).toEqual({ name: "gold", kind: "number", value: 212 });
    expect(fieldView(hp, { hp: 7, hp_max: "x" })).toMatchObject({ kind: "number", value: 7 });
  });

  test("a choice is pips with the current one, yes or no is one pip, text is the text", () => {
    expect(fieldView({ name: "mood", description: "", type: "choice", choices: ["calm", "hurt"] }, { mood: "hurt" })).toEqual({ name: "mood", kind: "pips", choices: ["calm", "hurt"], current: "hurt" });
    expect(fieldView({ name: "lit", description: "", type: "boolean" }, { lit: true })).toEqual({ name: "lit", kind: "flag", on: true });
    expect(fieldView({ name: "vow", description: "", type: "text" }, { vow: "Owes Mara" })).toEqual({ name: "vow", kind: "text", text: "Owes Mara" });
  });

  test("a bar's fill stays between its bottom and its top, from its min when it has one", () => {
    expect(fillOf(hp, 99, 20)).toBe(1);
    expect(fillOf(hp, -3, 20)).toBe(0);
    expect(fillOf({ name: "t", description: "", type: "number", min: 10 }, 15, 20)).toBe(0.5);
    expect(fillOf(hp, 5, 0)).toBe(0);
    expect(topOf(hp, { hp_max: 20 })).toBe(20);
  });

  test("a bar is dragged only over whole numbers; any other is typed", () => {
    expect(draggable(0, 20, 7)).toBe(true);
    expect(draggable(0, 2.5, 1)).toBe(false);
    expect(draggable(0, 20, 7.5)).toBe(false);
  });
});

describe("what a card draws", () => {
  test("a number that is another field's top is left out: its bar already shows it", () => {
    const t = body([hp, hpMax, { name: "gold", description: "", type: "number" }]);
    expect(cardFields(t, { hp: 7, hp_max: 20, gold: 1 }).map((f) => f.name)).toEqual(["hp", "gold"]);
    expect(cardFields(t, { hp: 7, hp_max: "x", gold: 1 }).map((f) => f.name)).toEqual(["hp", "hp_max", "gold"]);
  });

  test("a list's rows are tiles with the tracker's icon, and a count from the first number field", () => {
    const t = body([{ name: "qty", description: "", type: "number" }, { name: "note", description: "", type: "text" }], { layout: "list", icon: "lucide:star" });
    expect(itemTiles(t, [{ name: "rope", qty: 1, note: "" }, { name: "salt", qty: 3, note: "" }])).toEqual([{ name: "rope", icon: "lucide:star", count: 1 }, { name: "salt", icon: "lucide:star", count: 3 }]);
    expect(itemTiles(body([{ name: "note", description: "", type: "text" }], { layout: "list" }), [{ name: "rope", note: "" }])).toEqual([{ name: "rope" }]);
  });
});

describe("the words around a tracker", () => {
  test("the sentence for a reply's change: fields, rows added, removed and changed", () => {
    expect(changeSentence(42, [{ field: "hp", before: 10, after: 7 }, { field: "mood", before: "calm", after: "hurt" }])).toBe("Reply 42 changed hp 10 → 7 and mood calm → hurt.");
    expect(changeSentence(41, [{ row: "rope", before: null, after: { qty: 1 }, added: true }])).toBe("Reply 41 changed added rope.");
    expect(changeSentence(3, [{ row: "a", before: {}, after: null, removed: true }, { row: "b", before: {}, after: {} }, { field: "x", before: null, after: 1 }])).toBe("Reply 3 changed removed a, b changed and x none → 1.");
    expect(changeSentence(3, [])).toBeNull();
  });

  test("a piece's shape, from the stored piece, and nothing for what does not read as a tracker", () => {
    expect(shapeText("record", 3)).toBe("record, 3 fields");
    expect(shapeText("list", 1)).toBe("list, 1 field");
    expect(shapeOf({ body: { layout: "list", fields: [{}, {}] } })).toBe("list, 2 fields");
    for (const bad of [null, "x", { body: null }, { body: { layout: 1, fields: [] } }, { body: { layout: "record" } }]) expect(shapeOf(bad)).toBeNull();
  });

  test("a check adds the tracker at the end, once, and an uncheck takes it out", () => {
    expect(toggleLinked(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleLinked(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleLinked(["a", "b"], "a", false)).toEqual(["b"]);
    expect(toggleLinked(["a"], "z", false)).toEqual(["a"]);
  });
});
