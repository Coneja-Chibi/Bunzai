/** Strict runtime decoder for canonical formula bodies: shape and size only; unknown macros are reported when the formula runs. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import { SANITY_TEXT } from "../_shared/sanity";
import type { CanonicalFormula, FormulaBody } from "./schema";

const bodyShape = defineExhaustiveShape<FormulaBody>()({
  ...pieceShape,
  text: z.string().max(SANITY_TEXT),
});

export const formulaBodySchema = z.strictObject(bodyShape);
export const formulaProfileSchema = formulaBodySchema.partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalFormula>()(entityShape("formula", formulaBodySchema, formulaProfileSchema)));
