/** Semantic capability for regex-set name, description, and enabled state. */
import { z } from "zod";
import { defineContentCapability } from "../../_shared/define-content-capability";
import { nonEmptyPatch, nullsToUndefined } from "../../_shared/capability-schemas";
import type { CanonicalRegexSet } from "../schema";
import { patchRegexSet } from "../operations";
import { preview, targetSchema } from "./shared";

const patchSchema = nonEmptyPatch({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
});
const input = z.strictObject({ target: targetSchema, patch: patchSchema });

const capability = defineContentCapability<z.infer<typeof input>, CanonicalRegexSet>({
  id: "regex.settings.update",
  kind: "regex",
  area: "settings",
  action: "update",
  summary: "Change a standalone regex set's name, description, or enabled state.",
  aliases: ["rename regex set", "disable regex set"],
  input,
  preview: (entity, { patch }) => {
    const body = patchRegexSet(entity.body, nullsToUndefined(patch));
    return preview(entity, body, [{
      path: "body",
      label: "regex set settings",
      before: entity.body,
      after: body,
    }]);
  },
});

export default capability;
