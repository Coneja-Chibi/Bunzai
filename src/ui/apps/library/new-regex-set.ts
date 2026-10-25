/**
 * Create a blank regex set in the studio and return a summary for the workbench.
 * Mirrors new-lorebook.ts: save the empty body, hand back the summary the shelf and workbench share.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { emptyRegexSetBody } from "../../../entities/regex";
import { createAndOpenPiece } from "./new-piece";

export async function createAndOpenRegexSet(ctx: AppContext): Promise<StudioEntitySummary> {
  return createAndOpenPiece(ctx, "regex", "regex", emptyRegexSetBody("Untitled regex set"));
}
