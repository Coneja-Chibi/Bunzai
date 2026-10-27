/**
 * Dice: reading "NdS+M" notation and rolling it. The one dice system; the {{roll}} macro, the battle tracker, the spellbook and
 * the roll tool all call it. Limits and what bad notation means are each caller's (RoleCall's hosts disagree: the macro refuses,
 * the battle tracker rolls a d20), so this module only reads the shape. The caller hands in the randomness, so the same seed rolls
 * the same, and a roll draws exactly `count` values in order (the macro's RoleCall recording depends on it).
 */

export interface Dice { count: number; sides: number; modifier: number }
export interface DiceRoll { rolls: number[]; modifier: number; total: number }

const NOTATION = /^(\d*)d(\d+)([+-]\d+)?$/i;

/** "2d6", "d20", "1d20+5", "3d8-2" as written (callers trim), or null when it is not dice notation. */
export function readDice(text: string): Dice | null {
  const m = NOTATION.exec(text);
  if (!m) return null;
  return { count: m[1] ? Number.parseInt(m[1], 10) : 1, sides: Number.parseInt(m[2]!, 10), modifier: m[3] ? Number.parseInt(m[3], 10) : 0 };
}

export const DICE_COUNT_MAX = 100;
export const DICE_SIDES_MAX = 1_000;
/** The dice a person's own pieces may roll, in words for errors. */
export const DICE_RULE = `like 2d6 or 1d20+3, 1 to ${DICE_COUNT_MAX} dice of 2 to ${DICE_SIDES_MAX.toLocaleString("en-US")} sides`;

/** Dice a person's own pieces may roll (tools, dice), or null: see DICE_RULE. */
export function boundedDice(text: string): Dice | null {
  const d = readDice(text);
  return d && d.count >= 1 && d.count <= DICE_COUNT_MAX && d.sides >= 2 && d.sides <= DICE_SIDES_MAX ? d : null;
}

export function rollDice(dice: Dice, rand: () => number): DiceRoll {
  const rolls = Array.from({ length: dice.count }, () => Math.floor(rand() * dice.sides) + 1);
  return { rolls, modifier: dice.modifier, total: rolls.reduce((n, r) => n + r, 0) + dice.modifier };
}

/** "[3, 5] +2" as the logs write a roll. */
export const rollText = (roll: DiceRoll): string =>
  `[${roll.rolls.join(", ")}]${roll.modifier !== 0 ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : ""}`;
