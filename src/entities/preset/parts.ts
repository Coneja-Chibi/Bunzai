/**
 * Preset's part-split declaration (S3 drop-in; the contract is src/entities/kind-parts.ts). Only
 * `body.prompts` splits into item parts. Groups, choices, samplers, and every other body field stay
 * in the head part.
 */
import type { KindParts } from "../kind-parts";
import { promptSchema } from "./runtime-schema";
import type { PresetPrompt } from "./schema";

export const parts: KindParts<PresetPrompt> = {
  itemsField: "prompts",
  idOf: (item) => item.id,
  itemSchema: promptSchema,
};
