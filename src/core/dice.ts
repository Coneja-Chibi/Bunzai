/**
 * Dice: reading "NdS+M" notation and rolling it. The one dice system; the {{roll}} macro, the battle tracker, the spellbook and
 * the roll tool all call it. Limits and what bad notation means are each caller's (RoleCall's hosts disagree: the macro refuses,
 * the battle tracker rolls a d20), so this module only reads the shape. The caller hands in the randomness, so the same seed rolls
 * the same, and a roll draws exactly `count` values in order (the macro's RoleCall recording depends on it).
 */

import { SANITY_LIST, SANITY_NUMBER } from "../entities/_shared/sanity";

export interface Dice { count: number; sides: number; modifier: number }
export interface DiceRoll { rolls: number[]; modifier: number; total: number }

const NOTATION = /^(\d*)d(\d+)([+-]\d+)?$/i;

/** "2d6", "d20", "1d20+5", "3d8-2" as written (callers trim), or null when it is not dice notation. */
export function readDice(text: string): Dice | null {
  const m = NOTATION.exec(text);
  if (!m) return null;
  return { count: m[1] ? Number.parseInt(m[1], 10) : 1, sides: Number.parseInt(m[2]!, 10), modifier: m[3] ? Number.parseInt(m[3], 10) : 0 };
}

/** What dice are, in words for errors. The only bounds are the hostile-input ceilings (entities/_shared/sanity.ts); a roll is never refused for being big. */
export const DICE_RULE = "like 2d6 or 1d20+3, with at least 1 die of at least 2 sides";

/** Dice a person's own pieces may roll (tools, dice), or null: see DICE_RULE. Rolling costs one draw per die. */
export function boundedDice(text: string): Dice | null {
  const d = readDice(text);
  return d && d.count >= 1 && d.count <= SANITY_LIST && d.sides >= 2 && d.sides <= SANITY_NUMBER && Number.isSafeInteger(d.modifier) ? d : null;
}

export function rollDice(dice: Dice, rand: () => number): DiceRoll {
  // A die never shows more than its sides, whatever a generator hands back (one that returns exactly 1 would otherwise show sides + 1).
  const rolls = Array.from({ length: dice.count }, () => Math.min(dice.sides, Math.floor(rand() * dice.sides) + 1));
  return { rolls, modifier: dice.modifier, total: rolls.reduce((n, r) => n + r, 0) + dice.modifier };
}

/** Rolls an answer lists one by one; past it the text gives the count, lowest and highest (presentation tuning, not a limit: the roll and the trace keep every die). */
export const DICE_LIST_SHOWN = 20;

/** A roll as an answer reads it: every die while there are few, else how many, the lowest and the highest. */
export function rollSummary(roll: DiceRoll): string {
  if (roll.rolls.length <= DICE_LIST_SHOWN) return rollText(roll);
  let low = roll.rolls[0]!;
  let high = low;
  for (const r of roll.rolls) {
    if (r < low) low = r;
    if (r > high) high = r;
  }
  return `${roll.rolls.length} dice, lowest ${low}, highest ${high}${roll.modifier !== 0 ? `, ${roll.modifier > 0 ? "+" : ""}${roll.modifier} modifier` : ""}`;
}

/** "[3, 5] +2" as the logs write a roll. */
export const rollText = (roll: DiceRoll): string =>
  `[${roll.rolls.join(", ")}]${roll.modifier !== 0 ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : ""}`;
