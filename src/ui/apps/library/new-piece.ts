/**
 * Shared factory behind the five "create a blank piece" library actions: save the empty body,
 * hand back the summary the shelf and workbench share. Each piece kind keeps its own body factory
 * and wording; only the save-and-summarize plumbing is common.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";

interface PieceBody {
  name: string;
}

/** Save a freshly built empty piece body under `kind`/`id` and return its workbench summary. */
export async function createAndOpenPiece(
  ctx: AppContext,
  kind: string,
  id: string,
  body: PieceBody,
): Promise<StudioEntitySummary> {
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind,
    id,
    body,
  });
  return {
    id: saved.id,
    kind,
    name: saved.name || body.name,
    accent: saved.accent,
  };
}
