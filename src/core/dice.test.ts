/** Dice: notation is read once, a roll draws exactly its count in order from the caller's randomness. */
import { expect, test } from "bun:test";
import { readDice, rollDice, rollText } from "./dice";

test("reads NdS+M as written; anything else is not dice", () => {
  expect(readDice("2d6+3")).toEqual({ count: 2, sides: 6, modifier: 3 });
  expect(readDice("d20")).toEqual({ count: 1, sides: 20, modifier: 0 });
  expect(readDice("3D8-2")).toEqual({ count: 3, sides: 8, modifier: -2 });
  for (const bad of ["fire", "2d", "d", " 2d6", "2d6+", "1.5d6"]) expect(readDice(bad)).toBeNull();
});

test("a roll draws exactly count values, in order, and totals with the modifier", () => {
  const draws = [0, 0.5, 0.99];
  let calls = 0;
  const roll = rollDice({ count: 3, sides: 6, modifier: -1 }, () => draws[calls++]!);
  expect(calls).toBe(3);
  expect(roll).toEqual({ rolls: [1, 4, 6], modifier: -1, total: 10 });
  expect(rollText(roll)).toBe("[1, 4, 6] -1");
  expect(rollText(rollDice({ count: 1, sides: 20, modifier: 0 }, () => 0))).toBe("[1]");
});
