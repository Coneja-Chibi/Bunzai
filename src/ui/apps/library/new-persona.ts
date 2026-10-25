/**
 * Create a blank persona in the studio and return a summary for the workbench.
 * Mirrors new-regex-set.ts / new-lorebook.ts.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { emptyPersonaBody } from "../../../entities/persona";
import { createAndOpenPiece } from "./new-piece";

export async function createAndOpenPersona(ctx: AppContext): Promise<StudioEntitySummary> {
  return createAndOpenPiece(ctx, "persona", "persona", emptyPersonaBody("Untitled persona"));
}
