/** Shared target and receipt helper for pack capabilities. */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import type { CanonicalPack } from "../schema";
import { nonEmptyId } from "../../_shared/capability-schemas";
import { previewBodyChange } from "../../_shared/capability-preview";

export const targetSchema = z.strictObject({
  id: nonEmptyId,
  groupId: nonEmptyId.optional(),
});
export const preview = (
  entity: CanonicalPack,
  body: CanonicalPack["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<CanonicalPack> => {
  return previewBodyChange(entity, body, changes);
};
