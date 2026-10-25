/**
 * Persona capability helpers for strict targets and exact canonical preview rows.
 */
import { z } from "zod";
import type { CapabilityChange, CapabilityPreview } from "../../capabilities";
import { nonEmptyId, nonEmptyPatch, nullableOptionalText } from "../../_shared/capability-schemas";
import { readEntityPath, writeEntityPath } from "../../_shared/path-operations";
import { deepEq } from "../../../core/guards";
import type { CanonicalPersona, PersonaBody } from "../schema";

export const targetSchema = z.strictObject({
  id: nonEmptyId.describe("the persona piece id"),
});
export { nonEmptyPatch, nullableOptionalText };

export function previewPersonaPatch(
  entity: CanonicalPersona,
  patch: Readonly<Record<string, unknown>>,
  paths: Readonly<Record<string, string>>,
): CapabilityPreview<CanonicalPersona> {
  const before = entity.body as unknown as Record<string, unknown>;
  let after = before;
  for (const [field, value] of Object.entries(patch)) {
    const path = paths[field];
    if (path) {
      after = writeEntityPath(after, path, value === null ? undefined : value, (next) => next === undefined);
    }
  }
  const changes: CapabilityChange[] = [];
  for (const field of Object.keys(patch)) {
    const path = paths[field];
    if (!path) continue;
    const prior = readEntityPath(before, path);
    const next = readEntityPath(after, path);
    if (!deepEq(prior, next)) {
      changes.push({ path: `body.${path}`, label: field, before: prior, after: next });
    }
  }
  return {
    entity: changes.length
      ? { ...entity, body: after as unknown as PersonaBody }
      : entity,
    changes,
    warnings: [],
    platformImpact: [],
  };
}
