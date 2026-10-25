/** Shared canonical value schemas retain strict keys and distinct runtime/capability constraints. */
import { expect, test } from "bun:test";
import {
  capabilityMediaAssetSchema,
  capabilitySwatchSchema,
  runtimeMediaAssetSchema,
  runtimeSwatchSchema,
} from "./canonical-value-schemas";

test("runtime and capability value schemas share strict keys but keep their own emptiness rules", () => {
  expect(runtimeMediaAssetSchema.safeParse({ role: "portrait", ref: "" }).success).toBe(true);
  expect(capabilityMediaAssetSchema.safeParse({ role: "portrait", ref: "" }).success).toBe(false);
  expect(runtimeSwatchSchema.safeParse({ hex: "" }).success).toBe(true);
  expect(capabilitySwatchSchema.safeParse({ hex: "" }).success).toBe(false);
  expect(runtimeMediaAssetSchema.safeParse({ role: "portrait", ref: "x", extra: true }).success).toBe(false);
  expect(capabilitySwatchSchema.safeParse({ hex: "#fff", extra: true }).success).toBe(false);
});
