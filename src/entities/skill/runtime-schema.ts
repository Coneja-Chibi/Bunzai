/** Strict runtime decoder for canonical skill bodies; its triggers use the lorebook entry's own trigger decoder. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { pieceShape } from "../_shared/canonical-value-schemas";
import { SANITY_TEXT } from "../_shared/sanity";
import { selectiveLogicSchema, triggerSchema } from "../lorebook/runtime-schema";
import type { CanonicalSkill, SkillBody } from "./schema";

const bodyShape = defineExhaustiveShape<SkillBody>()({
  ...pieceShape,
  text: z.string().max(SANITY_TEXT),
  when: z.enum(["always", "mentioned", "picked"]),
  triggers: z.array(triggerSchema),
  primaryLogic: z.enum(["any", "all"]).optional(),
  secondaryTriggers: z.array(triggerSchema),
  selectiveLogic: selectiveLogicSchema,
  caseSensitive: z.boolean(),
  matchWholeWords: z.boolean(),
  scanDepth: z.number().int().min(0),
  closeWhenUnmentioned: z.boolean(),
});

export const skillBodySchema = z.strictObject(bodyShape);
export const skillProfileSchema = skillBodySchema.partial();

export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalSkill>()(entityShape("skill", skillBodySchema, skillProfileSchema)));
