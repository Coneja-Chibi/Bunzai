/** A dice piece: each type rolls through the dice math on the given randomness; the decoder holds each type to its own field. */
import { describe, expect, test } from "bun:test";
import { safeParseCanonicalEntity } from "../entities/runtime-schema";
import type { DiceBody } from "../entities/dice/schema";
import { rollDicePiece } from "./dice-piece";

const draws = (...values: number[]) => { let i = 0; return () => values[i++]!; };
const roll: DiceBody = { name: "Stealth", description: "", type: "roll", dice: " 1d20+3 " };
const table: DiceBody = { name: "Wild magic", description: "", type: "table", rows: [{ text: "Sparks", weight: 2 }, { text: "Rain smell", weight: 1 }] };
const pool: DiceBody = { name: "Shadow pool", description: "", type: "pool", pool: { count: 4, sides: 10, target: 8 } };

describe("rolling a piece", () => {
  test("a roll totals its dice", () => {
    expect(rollDicePiece(roll, draws(0.5))).toEqual({ text: "Stealth, 1d20+3: [11] +3 = 14", detail: { type: "roll", dice: "1d20+3", rolls: [11], modifier: 3, total: 14 } });
  });
  test("a table rolls one die the size of its weights and lands on the row that roll falls in", () => {
    expect(rollDicePiece(table, draws(0)).text).toBe("Wild magic (rolled 1 of 3): Sparks");
    expect(rollDicePiece(table, draws(0.4)).text).toBe("Wild magic (rolled 2 of 3): Sparks");
    expect(rollDicePiece(table, draws(0.99))).toEqual({ text: "Wild magic (rolled 3 of 3): Rain smell", detail: { type: "table", roll: 3, of: 3, row: 1 } });
  });
  test("a pool counts the dice at or over its target", () => {
    expect(rollDicePiece(pool, draws(0.75, 0.1, 0.95, 0.7))).toEqual({ text: "Shadow pool, 4d10, 8 or more: [8, 2, 10, 8] = 3 successes", detail: { type: "pool", rolls: [8, 2, 10, 8], target: 8, successes: 3 } });
    expect(rollDicePiece({ ...pool, pool: { count: 1, sides: 10, target: 8 } }, draws(0.9)).text).toEqual("Shadow pool, 1d10, 8 or more: [10] = 1 success");
  });
});

describe("the stored piece", () => {
  const ok = (body: unknown) => safeParseCanonicalEntity({ schemaVersion: "1", kind: "dice", id: "d", body }).ok;
  test("each type reads, and a blank one reads", () => {
    for (const b of [roll, table, pool]) expect(ok(b)).toBe(true);
    expect(ok({ name: "My dice", description: "", type: "roll", dice: "1d20" })).toBe(true);
  });
  test("a type carries its own field and nothing else, within the dice limits", () => {
    expect(ok({ ...roll, rows: table.rows })).toBe(false);
    expect(ok({ ...table, type: "pool" })).toBe(false);
    expect(ok({ name: "x", description: "", type: "roll" })).toBe(false);
    for (const dice of ["fireball", "1000d6", "1d1"]) expect(ok({ ...roll, dice })).toBe(false);
    expect(ok({ ...pool, pool: { count: 4, sides: 10, target: 11 } })).toBe(false);
    expect(ok({ ...table, rows: [] })).toBe(false);
    expect(ok({ ...table, rows: [{ text: "x", weight: 0 }] })).toBe(false);
  });
});
