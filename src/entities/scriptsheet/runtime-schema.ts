/** Strict runtime decoder for canonical Script Sheet bodies: shape and size only (the content rules live in core/preset/script-sheet.ts). */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type { ScriptSheetBody, CanonicalScriptSheet } from "./schema";
import { entityShape } from "../_shared/envelope";
import { samplerSchema } from "../preset/runtime-schema";
import { SCRIPT_SHEET_LIMIT } from "../../core/preset/script-sheet";

const bodyShape = defineExhaustiveShape<ScriptSheetBody>()({
  name: z.string().max(200),
  content: z.string().max(SCRIPT_SHEET_LIMIT),
  description: z.string().optional(),
  samplers: samplerSchema.optional(),
});

export const scriptSheetBodySchema = z.strictObject(bodyShape);
export const scriptSheetProfileSchema = scriptSheetBodySchema.partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalScriptSheet>()(entityShape("scriptsheet", scriptSheetBodySchema, scriptSheetProfileSchema)));
