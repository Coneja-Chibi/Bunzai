/**
 * Create a blank preset in the studio and return a summary for the workbench.
 * Mirrors new-persona.ts / new-regex-set.ts.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { emptyPresetBody } from "../../../entities/preset";
import { createAndOpenPiece } from "./new-piece";

export async function createAndOpenPreset(ctx: AppContext): Promise<StudioEntitySummary> {
  return createAndOpenPiece(ctx, "preset", "preset", emptyPresetBody("Untitled preset"));
}
