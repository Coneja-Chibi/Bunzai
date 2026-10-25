/**
 * Reusable strict Zod shapes for canonical values shared across semantic capability bundles.
 */
import { z } from "zod";
import { capabilityMediaAssetSchema, capabilitySwatchSchema } from "./canonical-value-schemas";

export const mediaAssetSchema = capabilityMediaAssetSchema;
export const swatchSchema = capabilitySwatchSchema;
export const nonEmptyId = z.string().min(1);
export const nullableOptionalText = z.string().nullable().optional();

export const nonEmptyPatch = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.strictObject(shape).refine((patch) => Object.keys(patch).length > 0, {
    message: "at least one field must change",
  });

/** Map every `null` value in a shallow patch to `undefined`, since the JSON-authored "clear this
 *  field" signal is null but the domain patch functions expect undefined for that field. */
export const nullsToUndefined = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, value === null ? undefined : value]));
