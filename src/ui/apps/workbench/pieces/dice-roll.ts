/**
 * A dice piece's roll as the one-line roll card shows it: the dice and their total for a roll, the chance die and the row it picked for a
 * table, the dice and the successes for a pool. The rolling itself is core/dice-piece.ts's (the same call a tool's action makes); this only
 * reads its detail, and says which table row was picked so the card can light it.
 */
import type { DiceRoll } from "../../../../core/dice";
import { rollSummary } from "../../../../core/dice";
import { rollDicePiece } from "../../../../core/dice-piece";
import type { DiceBody } from "../../../../entities/dice/schema";

export interface RollCard {
  /** The result line. */
  line: string;
  /** The table row picked, to light. */
  row?: number;
}

export function rollCard(body: DiceBody, rand: () => number): RollCard {
  const { detail } = rollDicePiece(body, rand);
  if (detail["type"] === "table") return { line: `Rolled ${String(detail["roll"])} of ${String(detail["of"])}: ${body.rows![detail["row"] as number]!.text}`, row: detail["row"] as number };
  if (detail["type"] === "pool") {
    const successes = detail["successes"] as number;
    return { line: `${rollSummary({ rolls: detail["rolls"] as number[], modifier: 0, total: 0 })} = ${String(successes)} ${successes === 1 ? "success" : "successes"}` };
  }
  return { line: `${rollSummary(detail as unknown as DiceRoll)} = ${String(detail["total"])}` };
}
