/** Strict runtime decoder for canonical dice bodies: a piece carries exactly the field its type rolls, within the hostile-input ceilings (entities/_shared/sanity.ts). */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { boundedDice, DICE_RULE } from "../../core/dice";
import { SANITY_LIST, SANITY_NUMBER, SANITY_TEXT } from "../_shared/sanity";
import { pieceShape } from "../_shared/canonical-value-schemas";
import type { CanonicalDice, DiceBody, DicePool, DiceRow } from "./schema";

const rowSchema = z.strictObject(defineExhaustiveShape<DiceRow>()({ text: z.string().min(1).max(SANITY_TEXT), weight: z.number().int().min(1).max(SANITY_NUMBER) }));
const poolSchema = z.strictObject(defineExhaustiveShape<DicePool>()({
  count: z.number().int().min(1).max(SANITY_LIST),
  sides: z.number().int().min(2).max(SANITY_NUMBER),
  target: z.number().int().min(1).max(SANITY_NUMBER),
})).refine((p) => p.target <= p.sides, "a pool's target must be at most its sides");

const bodyShape = defineExhaustiveShape<DiceBody>()({
  ...pieceShape,
  type: z.enum(["roll", "table", "pool"]),
  dice: z.string().optional(),
  rows: z.array(rowSchema).min(1).max(SANITY_LIST).optional(),
  pool: poolSchema.optional(),
});

const OWN = { roll: "dice", table: "rows", pool: "pool" } as const;

export const diceBodySchema = z.strictObject(bodyShape).superRefine((b, ctx) => {
  const present = (["dice", "rows", "pool"] as const).filter((k) => b[k] !== undefined);
  if (present.length !== 1 || present[0] !== OWN[b.type]) ctx.addIssue({ code: "custom", message: `a ${b.type} carries ${OWN[b.type]} and nothing else` });
  // The weights add up to the die a table rolls, so the total is held to the same ceiling: the pick stays an exact whole-number draw.
  if (b.rows !== undefined && b.rows.reduce((n, r) => n + r.weight, 0) > SANITY_NUMBER) ctx.addIssue({ code: "custom", message: "a table's weights add up to an unusually large number" });
  if (b.dice !== undefined && !boundedDice(b.dice.trim())) ctx.addIssue({ code: "custom", message: `a roll's dice must be ${DICE_RULE}` });
});
export const diceProfileSchema = z.strictObject(bodyShape).partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalDice>()(entityShape("dice", diceBodySchema, diceProfileSchema)));
