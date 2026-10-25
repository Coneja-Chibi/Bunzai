/** Shared target and receipt helper for standalone regex capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalRegexSet } from "../schema";
import { nonEmptyId } from "../../_shared/capability-schemas";
import { previewBodyChange } from "../../_shared/capability-preview";

export const targetSchema = z.strictObject({ id: nonEmptyId });
export const preview = (
  entity: CanonicalRegexSet,
  body: CanonicalRegexSet["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalRegexSet> => {
  return previewBodyChange(entity, body, changes);
};
