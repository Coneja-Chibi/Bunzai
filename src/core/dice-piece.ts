/**
 * What a dice piece rolls (entities/dice), on the caller's randomness through core/dice.ts: a roll totals its dice, a table picks a
 * row by weight (one die the size of all the weights), a pool counts the dice at or over its target. The piece was checked when it
 * was stored, so its fields are there.
 */
import type { DiceBody } from "../entities/dice/schema";
import { boundedDice, rollDice, rollText } from "./dice";

export interface DiceOutcome { text: string; detail: Record<string, unknown> }

export function rollDicePiece(body: DiceBody, rand: () => number): DiceOutcome {
  if (body.type === "table") {
    const rows = body.rows!;
    const sides = rows.reduce((n, r) => n + r.weight, 0);
    const roll = rollDice({ count: 1, sides, modifier: 0 }, rand).total;
    let left = roll;
    const row = rows.find((r) => (left -= r.weight) <= 0)!;
    return { text: `${body.name} (rolled ${roll} of ${sides}): ${row.text}`, detail: { type: "table", roll, of: sides, row: rows.indexOf(row) } };
  }
  if (body.type === "pool") {
    const { count, sides, target } = body.pool!;
    const { rolls } = rollDice({ count, sides, modifier: 0 }, rand);
    const successes = rolls.filter((r) => r >= target).length;
    return { text: `${body.name}, ${count}d${sides}, ${target} or more: [${rolls.join(", ")}] = ${successes} ${successes === 1 ? "success" : "successes"}`, detail: { type: "pool", rolls, target, successes } };
  }
  const notation = body.dice!.trim();
  const roll = rollDice(boundedDice(notation)!, rand);
  return { text: `${body.name}, ${notation}: ${rollText(roll)} = ${roll.total}`, detail: { type: "roll", dice: notation, ...roll } };
}
