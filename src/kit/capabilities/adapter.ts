/**
 * The only adapter from pure content capabilities to Kit's HarnessTool runtime.
 */
import {
  parseCanonicalEntity,
} from "../../entities/runtime-schema";
import { deepEq } from "../../core/guards";
import {
  providerToolName,
  type ContentCapability,
} from "../../entities/capabilities";
import type { ChangeSession } from "../changes/session";
import { reviewChangeDraft } from "../changes/review";
import type { HarnessTool } from "../tools/tool";
import { plural } from "../../core/text";

/** Bind a pure capability to Kit's bridge and one session-local draft composer. */
export function capabilityToHarnessTool(
  capability: ContentCapability,
  changes: ChangeSession,
): HarnessTool {
  return {
    name: providerToolName(capability.id),
    description: capability.effect === "read"
      ? `${capability.summary} Reads deterministic analysis; it does not create a draft.`
      : `${capability.summary} Creates a preview draft; it does not save the piece.`,
    exposure: capability.exposure,
    effect: capability.effect,
    input: capability.input,
    concurrencyKey: (args) => capability.concurrencyKey(args),
    async execute(args, { bridge, results }) {
      const target = typeof args === "object" && args !== null
        ? (args as { target?: { id?: unknown } }).target
        : undefined;
      const id = typeof target?.id === "string" ? target.id : "";
      const entity = id ? await bridge.read(capability.kind, id) : null;
      if (!entity) {
        return {
          summary: `draft ${capability.id}: target not found`,
          output: `No ${capability.kind} with id "${id}" is available to draft.`,
        };
      }

      if (capability.effect === "read") {
        const sourceEntity = parseCanonicalEntity(entity);
        const preview = capability.preview(sourceEntity, args);
        const observedEntity = parseCanonicalEntity(preview.entity);
        if (!deepEq(observedEntity, sourceEntity) || preview.changes.length > 0) {
          throw new Error(`${capability.id}: read capability attempted to change canonical content`);
        }
        const output = JSON.stringify({
          capabilityId: capability.id,
          target: { kind: capability.kind, id },
          observation: preview.observation ?? null,
          warnings: preview.warnings,
          platformImpact: preview.platformImpact,
        });
        const captured = results?.capture(`capability/${capability.id}`, output);
        return {
          summary: `read ${capability.id}`,
          output: captured?.spilled
            ? JSON.stringify(captured)
            : captured?.content ?? output,
        };
      }

      const pending = changes.forTarget(capability.kind, id);
      const draft = changes.draft(capability, args, entity);
      if (!draft) {
        // A draft exists only while it changes something (changes/session.ts).
        return {
          summary: `draft ${capability.id}: no change`,
          output: JSON.stringify({
            target: { kind: capability.kind, id },
            status: "unchanged",
            detail: pending
              ? `That brings ${capability.kind} "${id}" back to how it is saved, so draft ${pending.id} was dropped. Nothing is pending.`
              : `That changes nothing in ${capability.kind} "${id}", so no draft was made.`,
          }),
        };
      }
      const latest = draft.operations.at(-1)!;
      const count = latest.changes.length;
      return {
        summary: `draft ${capability.id}: ${plural(count, "change")}`,
        output: JSON.stringify({
          draftId: draft.id,
          target: draft.target,
          status: draft.status,
          operations: draft.operations,
          warnings: draft.warnings,
          platformImpact: draft.platformImpact,
        }),
        outcome: "draft",
        review: reviewChangeDraft(draft),
      };
    },
  };
}
