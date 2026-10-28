/** Dice: notation is read once, a roll draws exactly its count in order from the caller's randomness. */
import { expect, test } from "bun:test";
import { SANITY_LIST, SANITY_NUMBER } from "../entities/_shared/sanity";
import { boundedDice, DICE_LIST_SHOWN, readDice, rollDice, rollSummary, rollText } from "./dice";

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

test("owner rule: only hostile-input ceilings bound a roll, not product limits (150 dice and a 5,000-sided die roll)", () => {
  expect(boundedDice("150d6")).toEqual({ count: 150, sides: 6, modifier: 0 });
  expect(boundedDice("2d5000")).toEqual({ count: 2, sides: 5000, modifier: 0 });
  expect(boundedDice(`${SANITY_LIST}d6`)).not.toBeNull();
  expect(boundedDice(`2d${SANITY_NUMBER}`)).not.toBeNull();
  // past the sanity ceilings, and what dice cannot be, are refused
  for (const bad of [`${SANITY_LIST + 1}d6`, `2d${SANITY_NUMBER + 2}`, "0d6", "1d1", "1d0", "2d6+99999999999999999999", "99999999999999999999d6"]) expect(boundedDice(bad), bad).toBeNull();
});

test("a long roll is summarised past the display threshold, and the roll itself is whole", () => {
  const few = rollDice({ count: DICE_LIST_SHOWN, sides: 6, modifier: 1 }, () => 0);
  expect(rollSummary(few)).toBe(rollText(few));
  let i = 0;
  const many = rollDice({ count: DICE_LIST_SHOWN + 1, sides: 6, modifier: -1 }, () => (i++ % 6) / 6);
  expect(many.rolls).toHaveLength(DICE_LIST_SHOWN + 1);
  expect(rollSummary(many)).toBe(`${DICE_LIST_SHOWN + 1} dice, lowest 1, highest 6, -1 modifier`);
  expect(rollDice({ count: SANITY_LIST, sides: 20, modifier: 0 }, () => 0.5).rolls).toHaveLength(SANITY_LIST);
});
