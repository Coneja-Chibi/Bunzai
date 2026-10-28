/**
 * Canonical dice piece: something a person rolls, made once and used anywhere (a tool, a scene, a promptbook). One kind, three
 * types: a roll (dice notation such as 1d20+3), a table (rows picked by weight), or a pool (count the dice that meet a target).
 * The rolling is core/dice.ts's math; core/dice-piece.ts says what each type rolls.
 */
import type { CanonicalEntity } from "../../core/canonical";

export type DiceType = "roll" | "table" | "pool";

/** A table row: its text and how many chances it has (a whole number weight of 1 or more). */
export interface DiceRow { text: string; weight: number }

/** A pool: `count` dice of `sides`; each die at or over `target` is a success. */
export interface DicePool { count: number; sides: number; target: number }

export interface DiceBody {
  name: string;
  description: string;
  type: DiceType;
  /** A roll's dice. */
  dice?: string;
  /** A table's rows. */
  rows?: DiceRow[];
  /** A pool's dice and target. */
  pool?: DicePool;
}

export type CanonicalDice = CanonicalEntity<"dice", DiceBody>;

export const emptyDiceBody = (name: string): DiceBody => ({ name, description: "", type: "roll", dice: "1d20" });
