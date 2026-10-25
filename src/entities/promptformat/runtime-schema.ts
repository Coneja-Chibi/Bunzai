/** Strict runtime decoder for canonical prompt-format bodies. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type { PromptFormatBody } from "./schema";

const part = z.record(z.string().max(100), z.union([z.string().max(200_000), z.number(), z.boolean()]));

const bodyShape = defineExhaustiveShape<PromptFormatBody>()({
  name: z.string().max(200),
  instruct: part.optional(),
  context: part.optional(),
  notes: z.string().optional(),
});

export const promptFormatBodySchema = z.strictObject(bodyShape);
export const promptFormatProfileSchema = promptFormatBodySchema.partial();
