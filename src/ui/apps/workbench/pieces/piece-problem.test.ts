/** The sentence a draft piece is refused with: the kind's own decoder decides, and the sentence names the field or row. */
import { describe, expect, test } from "bun:test";
import { pieceProblem } from "./piece-problem";

const tracker = (fields: unknown[], extra: Record<string, unknown> = {}) => ({ name: "Health", description: "", layout: "record", note: "", fields, ...extra });
const field = (extra: Record<string, unknown> = {}) => ({ name: "hp", description: "", type: "number", ...extra });

describe("a draft the decoder accepts", () => {
  test("has no problem", () => {
    expect(pieceProblem("tracker", tracker([field()]))).toBeNull();
    expect(pieceProblem("tool", { name: "Roll", description: "", fields: [], action: { kind: "record" } })).toBeNull();
    expect(pieceProblem("dice", { name: "D", description: "", type: "roll", dice: "1d20" })).toBeNull();
    expect(pieceProblem("formula", { name: "F", description: "", text: "" })).toBeNull();
  });
});

describe("a draft it refuses", () => {
  test("names the piece, a field or a row", () => {
    expect(pieceProblem("tracker", { ...tracker([field()]), name: "" })).toBe("Give it a name.");
    expect(pieceProblem("tracker", tracker([]))).toBe("A tracker needs at least one field.");
    expect(pieceProblem("tracker", tracker([field({ name: "Bad Name" })]))).toBe('Field "Bad Name" needs a name of lowercase letters, digits and _, starting with a letter.');
    expect(pieceProblem("tracker", tracker([field({ type: "choice", choices: [] })]))).toBe('Field "hp" needs at least one choice, and no choice twice.');
    expect(pieceProblem("tracker", tracker([field({ maxField: "gone" })]))).toBe('Field "hp": The top must be a field of this tracker.');
    expect(pieceProblem("tracker", tracker([field(), field()]))).toBe("Field names must be different from each other.");
    expect(pieceProblem("dice", { name: "T", description: "", type: "table", rows: [{ text: "", weight: 1 }] })).toBe("Row 1 needs some text and a weight of 1 or more.");
    expect(pieceProblem("dice", { name: "T", description: "", type: "pool", pool: { count: 0, sides: 6, target: 5 } })).toContain("A pool needs");
  });

  test("a tool's roll must read one of its text fields, and a linked piece must be picked", () => {
    const fields = [{ name: "dice", description: "", type: "number", required: true }];
    expect(pieceProblem("tool", { name: "T", description: "", fields, action: { kind: "roll", field: "dice" } })).toBe("The roll must read one of the tool's text fields.");
    expect(pieceProblem("tool", { name: "T", description: "", fields: [], action: { kind: "dice", id: "" } })).toBe("Pick the piece it uses.");
  });
});

describe("every refusal is plain words, never a key name (the review's probes)", () => {
  const readable = (kind: Parameters<typeof pieceProblem>[0], body: unknown): string => pieceProblem(kind, body) ?? "";
  test("a top that is not a number, a loop, itself, and a range the wrong way round", () => {
    const fields = (extra: Record<string, unknown>[]) => extra.map((e, i) => field({ name: i === 0 ? "hpmax" : "hp", ...e }));
    expect(readable("tracker", tracker(fields([{ type: "text" }, { maxField: "hpmax" }])))).toBe('Field "hp": The top must be a number field.');
    expect(readable("tracker", tracker([field({ maxField: "hp" })]))).toBe('Field "hp": A field cannot be its own top.');
    expect(readable("tracker", tracker([field({ name: "a", maxField: "b" }), field({ name: "b", maxField: "a" })]))).toBe('Field "a": Tops cannot lead back around to the field they belong to.');
    expect(readable("tracker", tracker([field({ min: 10, max: 2 })]))).toBe('Field "hp": From must be at most To.');
    expect(readable("tracker", tracker([field({ default: 50, max: 2 })]))).toBe("Field \"hp\": The starting value must fit the field's type, choices and range.");
    expect(readable("tracker", tracker([field({ type: "text", min: 1 })]))).toBe('Field "hp": Only a number can have a range or a top.');
  });

  test("a bad name, a name used twice and a list with a field called name", () => {
    expect(readable("tracker", tracker([field({ name: "Hp" })]))).toContain("needs a name of lowercase letters");
    expect(readable("tracker", tracker([field({ name: "name" })], { layout: "list" }))).toBe("A list's rows are keyed by name, so no field can be called name.");
  });

  test("a roll whose dice cannot be read says what dice are", () => {
    expect(readable("dice", { name: "D", description: "", type: "roll", dice: "abc" })).toBe("The dice must be like 2d6 or 1d20+3, with at least 1 die of at least 2 sides.");
  });

  test("a value of the wrong kind is not shown as a decoder's message", () => {
    expect(readable("tracker", tracker([field({ type: "number", description: 7 })]))).toBe('Field "hp": Something in this piece is not valid.');
  });
});
