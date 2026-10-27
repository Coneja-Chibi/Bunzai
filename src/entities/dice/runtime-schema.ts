/** Strict runtime decoder for canonical dice bodies: a piece carries exactly the field its type rolls, within the dice limits. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { boundedDice, DICE_COUNT_MAX, DICE_RULE, DICE_SIDES_MAX } from "../../core/dice";
import { pieceShape } from "../_shared/canonical-value-schemas";
import type { CanonicalDice, DiceBody, DicePool, DiceRow } from "./schema";

export const DICE_ROWS_MAX = 200;

const rowSchema = z.strictObject(defineExhaustiveShape<DiceRow>()({ text: z.string().min(1).max(1_000), weight: z.number().int().min(1).max(1_000) }));
const poolSchema = z.strictObject(defineExhaustiveShape<DicePool>()({
  count: z.number().int().min(1).max(DICE_COUNT_MAX),
  sides: z.number().int().min(2).max(DICE_SIDES_MAX),
  target: z.number().int().min(1),
})).refine((p) => p.target <= p.sides, "a pool's target must be at most its sides");

const bodyShape = defineExhaustiveShape<DiceBody>()({
  ...pieceShape,
  type: z.enum(["roll", "table", "pool"]),
  dice: z.string().max(20).optional(),
  rows: z.array(rowSchema).min(1).max(DICE_ROWS_MAX).optional(),
  pool: poolSchema.optional(),
});

const OWN = { roll: "dice", table: "rows", pool: "pool" } as const;

export const diceBodySchema = z.strictObject(bodyShape).superRefine((b, ctx) => {
  const present = (["dice", "rows", "pool"] as const).filter((k) => b[k] !== undefined);
  if (present.length !== 1 || present[0] !== OWN[b.type]) ctx.addIssue({ code: "custom", message: `a ${b.type} carries ${OWN[b.type]} and nothing else` });
  if (b.dice !== undefined && !boundedDice(b.dice.trim())) ctx.addIssue({ code: "custom", message: `a roll's dice must be ${DICE_RULE}` });
});
export const diceProfileSchema = z.strictObject(bodyShape).partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalDice>()(entityShape("dice", diceBodySchema, diceProfileSchema)));
