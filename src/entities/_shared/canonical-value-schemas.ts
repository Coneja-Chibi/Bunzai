/** Shared strict decoders for canonical media values, with boundary-specific reference constraints. */
import { z } from "zod";
import { defineExhaustiveShape } from "./runtime-shape";
import { SANITY_TEXT } from "./sanity";
import type { MediaAsset, Swatch } from "../character/schema";

const mediaAssetShape = defineExhaustiveShape<MediaAsset>()({
  role: z.enum(["portrait", "emotion", "outfit", "pose", "background", "other"]),
  ref: z.string(),
  name: z.string().optional(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
  mime: z.string().optional(),
});
const swatchShape = defineExhaustiveShape<Swatch>()({
  label: z.string().optional(),
  name: z.string().optional(),
  hex: z.string(),
});

/** The name and description a small library piece (dice, formula, tool, tracker) carries; bounded only by the hostile-input text ceiling. */
export const pieceShape = { name: z.string().min(1).max(SANITY_TEXT), description: z.string().max(SANITY_TEXT) };

export const runtimeMediaAssetSchema = z.strictObject(mediaAssetShape);
export const runtimeSwatchSchema = z.strictObject(swatchShape);
export const capabilityMediaAssetSchema = z.strictObject({ ...mediaAssetShape, ref: z.string().min(1) });
export const capabilitySwatchSchema = z.strictObject({ ...swatchShape, hex: z.string().min(1) });
