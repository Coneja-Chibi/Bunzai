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
    for (const dice of ["fireball", "10001d6", "1d1"]) expect(ok({ ...roll, dice })).toBe(false);
    // owner rule (limits rework): a big roll, a 300-row table, a heavy weight and a long row are pieces now; only a hostile file is refused
    for (const dice of ["1000d6", "150d6+4", "2d5000"]) expect(ok({ ...roll, dice })).toBe(true);
    expect(ok({ ...table, rows: Array.from({ length: 300 }, (_, i) => ({ text: "x".repeat(2_000) + i, weight: 5_000 })) })).toBe(true);
    expect(ok({ ...table, rows: Array.from({ length: 10_001 }, (_, i) => ({ text: String(i), weight: 1 })) })).toBe(false);
    expect(ok({ ...table, rows: [{ text: "x".repeat(1_000_001), weight: 1 }] })).toBe(false);
    expect(ok({ ...table, rows: [{ text: "x", weight: 1.5 }] })).toBe(false);
    expect(ok({ ...pool, pool: { count: 500, sides: 5_000, target: 4_000 } })).toBe(true);
    expect(ok({ ...pool, pool: { count: 4, sides: 10, target: 11 } })).toBe(false);
    expect(ok({ ...table, rows: [] })).toBe(false);
    expect(ok({ ...table, rows: [{ text: "x", weight: 0 }] })).toBe(false);
  });
});

describe("a long roll in the answer", () => {
  test("past the display threshold the text gives count, lowest, highest and total, and the trace detail keeps every die", () => {
    const big: DiceBody = { name: "Horde", description: "", type: "roll", dice: "40d6" };
    const out = rollDicePiece(big, () => 0.5);
    expect(out.text).toBe("Horde, 40d6: 40 dice, lowest 4, highest 4 = 160");
    expect(out.detail["rolls"]).toHaveLength(40);
    const bigPool: DiceBody = { name: "Swarm", description: "", type: "pool", pool: { count: 40, sides: 10, target: 6 } };
    const p = rollDicePiece(bigPool, () => 0.5);
    expect(p.text).toBe("Swarm, 40d10, 6 or more: 40 dice, lowest 6, highest 6 = 40 successes");
    expect((p.detail["rolls"] as number[]).length).toBe(40);
  });
});

describe("third fix round: very heavy tables", () => {
  test("a table whose weights add up past the sanity ceiling is refused, and one at it still lands on a row (no fallback needed)", () => {
    const M = Number.MAX_SAFE_INTEGER;
    const ok = (rows: { text: string; weight: number }[]) => safeParseCanonicalEntity({ schemaVersion: "1", kind: "dice", id: "d", body: { name: "T", description: "", type: "table", rows } }).ok;
    expect(ok([{ text: "a", weight: M }])).toBe(true);
    expect(ok([{ text: "a", weight: M }, { text: "b", weight: 1 }])).toBe(false);
    expect(ok([{ text: "a", weight: M - 5 }, { text: "b", weight: 3 }, { text: "c", weight: 2 }])).toBe(true);
    const body: DiceBody = { name: "T", description: "", type: "table", rows: [{ text: "a", weight: M - 5 }, { text: "b", weight: 3 }, { text: "c", weight: 2 }] };
    for (const x of [0, 0.5, 1 - 2 ** -53, 1 - 2 ** -52]) expect(rollDicePiece(body, () => x).text, String(x)).toMatch(/: [abc]$/);
  });

  test("a die never shows more than its sides, whatever a generator hands back", () => {
    expect(rollDicePiece({ name: "T", description: "", type: "roll", dice: "1d6" }, () => 1).text).toBe("T, 1d6: [6] = 6");
    expect(rollDicePiece({ name: "T", description: "", type: "table", rows: [{ text: "a", weight: 2 }, { text: "b", weight: 1 }] }, () => 1).text).toBe("T (rolled 3 of 3): b");
  });
});

describe("second fix round: a table of very heavy rows always lands on a row", () => {
  test("weights near the largest safe integer, where the running sum loses precision, never leave the roll without a row", () => {
    const M = Number.MAX_SAFE_INTEGER;
    for (const weights of [[M, 3], [3, M], [M, M, 1], [1, M, M, M]]) {
      const body: DiceBody = { name: "T", description: "", type: "table", rows: weights.map((weight, i) => ({ text: `r${i}`, weight })) };
      for (const x of [0, 0.5, 1 - 2 ** -53, 1 - 2 ** -52, 1 - 1e-15]) expect(rollDicePiece(body, () => x).text, `${weights} @ ${x}`).toMatch(/: r\d$/);
    }
  });
});
