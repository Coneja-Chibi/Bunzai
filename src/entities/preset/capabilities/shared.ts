/** Shared strict target and preview helpers for preset capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalPreset } from "../schema";
import { nonEmptyId } from "../../_shared/capability-schemas";

export const targetSchema = z.strictObject({ id: nonEmptyId });

export function presetPreview(
  before: CanonicalPreset,
  body: CanonicalPreset["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalPreset> {
  return {
    entity: changes.length ? { ...before, body } : before,
    changes,
    warnings: [],
    platformImpact: [],
  };
}
