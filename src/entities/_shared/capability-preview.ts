/** Shared preview result for canonical body edits that preserve entity identity on no-op. */
import type { CapabilityChange, CapabilityPreview } from "../capabilities";
import { deepEq } from "../../core/guards";
import type { ParsedCanonicalEntity } from "../runtime-schema";

export function previewBodyChange<E extends ParsedCanonicalEntity>(
  entity: E,
  body: E["body"],
  changes: readonly CapabilityChange[],
): CapabilityPreview<E> {
  const unchanged = deepEq(entity.body, body);
  return {
    entity: unchanged ? entity : { ...entity, body } as E,
    changes: unchanged ? [] : changes,
    warnings: [],
    platformImpact: [],
  };
}
