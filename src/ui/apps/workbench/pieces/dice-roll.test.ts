/** The roll card's line for each dice type, from the real piece roll on a fixed generator, and the rows a pasted list makes. */
import { describe, expect, test } from "bun:test";
import type { DiceBody } from "../../../../entities/dice/schema";
import { rowsFromList } from "./dice-table";
import { rollCard } from "./dice-roll";

const base = { name: "Weather", description: "" };

describe("rolling a piece", () => {
  test("a roll shows its dice and total", () => {
    // a generator at 0.7 shows 15 on a d20 and 5 on a d6
    expect(rollCard({ ...base, type: "roll", dice: "1d20+5" }, () => 0.7)).toEqual({ line: "[15] +5 = 20" });
    expect(rollCard({ ...base, type: "roll", dice: "2d6" }, () => 0.7).line).toBe("[5, 5] = 10");
  });

  test("a table shows the chance die and the row it picked, and says which row to light", () => {
    const table: DiceBody = { ...base, type: "table", rows: [{ text: "Clear and cold", weight: 5 }, { text: "Sea fog rolls in", weight: 3 }, { text: "Squall", weight: 1 }, { text: "Bells", weight: 1 }] };
    expect(rollCard(table, () => 0.7)).toEqual({ line: "Rolled 8 of 10: Sea fog rolls in", row: 1 });
    expect(rollCard(table, () => 0)).toEqual({ line: "Rolled 1 of 10: Clear and cold", row: 0 });
    expect(rollCard(table, () => 0.99)).toEqual({ line: "Rolled 10 of 10: Bells", row: 3 });
  });

  test("a pool shows its dice and counts the ones at or over the target", () => {
    expect(rollCard({ ...base, type: "pool", pool: { count: 3, sides: 10, target: 7 } }, () => 0.7)).toEqual({ line: "[8, 8, 8] = 3 successes" });
    expect(rollCard({ ...base, type: "pool", pool: { count: 2, sides: 10, target: 9 } }, () => 0.7)).toEqual({ line: "[8, 8] = 0 successes" });
    expect(rollCard({ ...base, type: "pool", pool: { count: 1, sides: 6, target: 5 } }, () => 0.99).line).toBe("[6] = 1 success");
  });
});

describe("a pasted list", () => {
  test("is one row per line with text, each of weight 1; blank lines are skipped", () => {
    expect(rowsFromList("Clear\r\n\n  Fog  \nStorm\n")).toEqual([{ text: "Clear", weight: 1 }, { text: "Fog", weight: 1 }, { text: "Storm", weight: 1 }]);
    expect(rowsFromList("  \n")).toEqual([]);
  });
});
