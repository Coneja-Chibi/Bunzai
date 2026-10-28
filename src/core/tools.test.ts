/** A library tool: one field list makes its schema and its argument check; roll draws from the given randomness; the decoder holds the shape. */
import { describe, expect, test } from "bun:test";
import { safeParseCanonicalEntity } from "../entities/runtime-schema";
import type { ToolBody } from "../entities/tool/schema";
import { callName, readToolCall, runTool, toolParameters } from "./tools";

const check: ToolBody = {
  name: "Skill check!", description: "Roll when an outcome is uncertain.",
  fields: [
    { name: "dice", description: "Dice to roll, like 1d20+3.", type: "text", required: true },
    { name: "skill", description: "Which skill.", type: "choice", choices: ["stealth", "charm"], required: false },
    { name: "hard", description: "A hard check.", type: "boolean", required: false },
  ],
  action: { kind: "roll", field: "dice" },
};

describe("the model's side", () => {
  test("the schema and the call name come from the tool", () => {
    expect(callName(check.name)).toBe("skill_check");
    // always a name the tool loop takes: a letter first
    expect(callName("20 sided roll")).toBe("tool_20_sided_roll");
    expect(callName("!!!")).toBe("tool");
    expect(callName("x".repeat(80))).toHaveLength(60);
    expect(toolParameters(check.fields)).toEqual({
      type: "object",
      properties: {
        dice: { type: "string", description: "Dice to roll, like 1d20+3." },
        skill: { type: "string", description: "Which skill.", enum: ["stealth", "charm"] },
        hard: { type: "boolean", description: "A hard check." },
      },
      required: ["dice"],
      additionalProperties: false,
    });
  });

  test("arguments are checked once against the fields, and a roll's dice with them; refusals are words for the model", () => {
    expect(readToolCall(check, { dice: "1d20+3", skill: "charm" })).toEqual({ args: { dice: "1d20+3", skill: "charm" } });
    expect(readToolCall(check, { dice: "1d20", luck: 1 })).toEqual({ error: "Unknown arguments: luck." });
    expect(readToolCall(check, {})).toEqual({ error: "dice is required." });
    expect(readToolCall(check, { dice: "1d20", skill: "magic" })).toEqual({ error: "skill must be one of: stealth, charm." });
    expect(readToolCall(check, { dice: "1d20", hard: "yes" })).toEqual({ error: "hard must be a boolean." });
    expect(readToolCall(check, { dice: "fireball" })).toEqual({ error: '"fireball" is not dice this tool can roll (like 2d6 or 1d20+3, with at least 1 die of at least 2 sides).' });
    expect(readToolCall(check, "1d20")).toEqual({ error: "Arguments must be an object." });
    // a field named like an inherited property is only ever the model's own argument
    const own = { ...check, fields: [{ name: "constructor", description: "", type: "text" as const, required: false }], action: { kind: "record" as const } };
    expect(readToolCall(own, {})).toEqual({ args: {} });
  });

  test("a roll is the dice module's roll on the given randomness; record only records", () => {
    const answer = runTool(check, { dice: " 2d6+1 " }, () => 0.5);
    expect(answer).toEqual({ text: "Rolled 2d6+1: [4, 4] +1 = 9", detail: { dice: "2d6+1", rolls: [4, 4], modifier: 1, total: 9 } });
    const d4 = { name: "Luck", description: "", type: "roll" as const, dice: "1d4" };
    expect(runTool({ ...check, action: { kind: "dice", id: "luck" } }, {}, () => 0, { dice: d4 }).text).toBe("Luck, 1d4: [1] = 1");
    expect(runTool({ ...check, action: { kind: "record" } }, { dice: "x" }, () => 0)).toEqual({ text: "Recorded.", detail: {} });
  });
});

describe("the stored piece", () => {
  const entity = (body: unknown) => safeParseCanonicalEntity({ schemaVersion: "1", kind: "tool", id: "t", body }).ok;
  test("a tool reads; a blank one reads", () => {
    expect(entity(check)).toBe(true);
    expect(entity({ name: "My tool", description: "", fields: [], action: { kind: "record" } })).toBe(true);
  });
  test("bad shapes are refused", () => {
    const f = check.fields;
    expect(entity({ ...check, action: { kind: "roll" } })).toBe(false);
    expect(entity({ ...check, action: { kind: "roll", field: "dice", dice: "1d6" } })).toBe(false);
    expect(entity({ ...check, action: { kind: "dice", id: "" } })).toBe(false);
    expect(entity({ ...check, action: { kind: "dice", id: "luck" } })).toBe(true);
    expect(entity({ ...check, action: { kind: "roll", field: "skill" } })).toBe(false);
    expect(entity({ ...check, fields: [f[0], f[0]] })).toBe(false);
    expect(entity({ ...check, fields: [{ ...f[1], choices: undefined }] })).toBe(false);
    expect(entity({ ...check, fields: [{ ...f[0], choices: ["a"] }] })).toBe(false);
    expect(entity({ ...check, fields: [{ ...f[0], name: "Dice" }] })).toBe(false);
    expect(entity({ ...check, action: { kind: "run", code: "x" } })).toBe(false);
    expect(entity({ ...check, fields: [{ ...f[1], choices: ["a", "a"] }] })).toBe(false);
  });
});

describe("owner rule (limits rework): no product limits on a tool, only hostile-input ceilings", () => {
  const entity = (body: unknown) => safeParseCanonicalEntity({ schemaVersion: "1", kind: "tool", id: "t", body }).ok;
  test("a model's long text argument is taken whole", () => {
    const note = { ...check, action: { kind: "record" as const }, fields: [{ name: "what", description: "", type: "text" as const, required: true }] };
    const long = "x".repeat(50_000);
    expect(readToolCall(note, { what: long })).toEqual({ args: { what: long } });
  });
  test("more than 12 fields, 20 choices, long choices and long descriptions read", () => {
    const fields = Array.from({ length: 40 }, (_, i) => ({ name: `f${i}`, description: "d".repeat(5_000), type: "text" as const, required: false }));
    expect(entity({ name: "Wide", description: "", fields, action: { kind: "record" } })).toBe(true);
    const choices = Array.from({ length: 300 }, (_, i) => `choice ${i} ${"c".repeat(400)}`);
    expect(entity({ name: "Pick", description: "", fields: [{ name: "pick", description: "", type: "choice", choices, required: true }], action: { kind: "record" } })).toBe(true);
    expect(entity({ name: "Id", description: "", fields: [], action: { kind: "dice", id: "i".repeat(500) } })).toBe(true);
  });
  test("a hostile file is refused: past the list and text ceilings", () => {
    expect(entity({ name: "x", description: "", fields: Array.from({ length: 10_001 }, (_, i) => ({ name: `f${i}`, description: "", type: "text", required: false })), action: { kind: "record" } })).toBe(false);
    expect(entity({ name: "x", description: "", fields: [{ name: "a", description: "d".repeat(1_000_001), type: "text", required: false }], action: { kind: "record" } })).toBe(false);
  });
  test("a field name keeps the provider's 64-character function rule", () => {
    const named = (name: string) => entity({ name: "x", description: "", fields: [{ name, description: "", type: "text", required: false }], action: { kind: "record" } });
    expect(named("a".repeat(64))).toBe(true);
    expect(named("a".repeat(65))).toBe(false);
  });
});
