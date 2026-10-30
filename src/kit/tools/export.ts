/**
 * Studio export: convert one stored piece to another platform's format and write the file.
 *
 * THE MODEL NEVER SUPPLIES A PATH. It names a piece and a target format; the filename is derived
 * from the piece id plus the adapter's own extension, and the file lands in its own folder,
 * `<studio>/Export/<stamp> Kit <id>/`, like every other export.
 * That is what makes a model-callable file write safe: there is no path argument to redirect, so
 * containment is structural rather than a validation anyone can forget. `exportRunFileName` and
 * `resolveStudioExportRunPath` additionally keep the name one plain segment and restrict the extension
 * to a closed set.
 *
 * Create-only. An export that silently replaced an earlier file could destroy something already
 * sent to someone, and unlike a canonical piece there is no revision history to recover it from.
 *
 * Binary carriers (the JanitorAI and Saucepan PNG cards, a Pygmalion card with art, .charx, .byaf)
 * are written as the adapter's bytes, untouched: `StudioExports` writes them create-only straight to disk, beside
 * the text it writes through the StudioFs seam.
 *
 * Shares `convertStoredPiece` with `studio_transfer`, so the preview and the write can never report
 * different losses.
 *
 * WHY DIRECT. `capabilities/runtime.ts` refuses any DEFERRED workflow whose effect is `apply`,
 * because discovery metadata must never be what classifies a write. A deferred tool carrying no
 * discovery descriptor is worse than refused: it registers but can never be revealed, so the model
 * cannot reach it at all. Direct also removes a reliability dependency that matters here. "Convert
 * my preset" has to work every time, and a deferred tool only works when search ranks it into the
 * top five. Its one classification is the explicit `["studio_export", "write"]` entry in the safety
 * trust map, so it still pauses at the Gate under the default guarded mode.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import { conversionReceiptFields, convertStoredPiece, loadConversionKit } from "./_transfer-common";

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().trim().min(1).max(120).describe("exact studio id of the piece to export"),
  to: z.string().trim().min(1).max(80)
    .describe("target format adapter id, such as sillytavern-preset or sillytavern-lorebook"),
});

const exportPiece: HarnessTool<z.infer<typeof input>> = {
  name: "studio_export",
  description:
    "Convert a stored piece to another platform's format and write it into its own folder under the "
    + "studio's Export folder. Reports the exact file written plus everything the conversion cost: dropped fields "
    + "and macros that will not resolve on the target engine.",
  exposure: "direct",
  effect: "apply",
  input,
  concurrencyKey: ({ kind, id }) => `studio/export/${kind}/${id}`,
  async execute({ kind, id, to }, { bridge, exports: exportStore }) {
    if (!exportStore) {
      return {
        summary: `export ${kind}/${id}: unavailable`,
        output: "This Kit session has no exports folder bound, so nothing was written.",
        outcome: "failed",
      };
    }
    const kit = await loadConversionKit();
    const entity = await bridge.read(kind, id);
    if (!entity) {
      return {
        summary: `export ${kind}/${id}: not found`,
        output: `No ${kind} with id "${id}" in the studio. Nothing was written.`,
        outcome: "stale",
      };
    }

    const outcome = await convertStoredPiece(kit, bridge, entity, kind, to);
    if (!outcome.ok) {
      return {
        summary: `export ${kind}/${id}: ${outcome.reason}`,
        output: `${outcome.detail} Nothing was written.`,
        outcome: "failed",
      };
    }
    const body = outcome.text ?? outcome.bytes;
    if (body === null) {
      return {
        summary: `export ${kind}/${id}: empty output`,
        output: `"${to}" produced no file for this piece. Nothing was written.`,
        outcome: "failed",
      };
    }

    let receipt;
    try {
      receipt = await exportStore.write(id, outcome.suggestedExtension, body);
    } catch (error) {
      return {
        summary: `export ${kind}/${id}: write failed`,
        output: `Could not finish the export: ${(error as Error).message}. Check the Export folder before retrying.`,
        outcome: "failed",
      };
    }
    if (receipt.status === "exists") {
      return {
        summary: `export ${kind}/${id}: already exists`,
        output:
          `${receipt.relativePath} appeared while this export was writing and was NOT replaced. `
          + "Run the export again: it lands in a fresh folder.",
        outcome: "stale",
      };
    }

    const changes = outcome.translation ?? [];
    const needsReview = changes.filter((c) => c.kind === "collision" || c.kind === "absent");
    const deaths = outcome.macros?.findings.length ?? 0;
    const notes = [
      changes.length ? `${changes.length} macros translated` : "",
      outcome.macros?.checked && deaths ? `${deaths} still unsupported` : "",
      needsReview.length ? `${needsReview.length} need review` : "",
    ].filter(Boolean);
    return {
      summary:
        `export ${kind}/${id} -> ${receipt.relativePath}`
        + (notes.length ? ` (${notes.join(", ")})` : ""),
      output: JSON.stringify({
        wrote: receipt.relativePath,
        path: receipt.path,
        bytes: receipt.bytes,
        to,
        ...conversionReceiptFields(outcome),
      }),
      outcome: "applied",
    };
  },
};

export default exportPiece;
