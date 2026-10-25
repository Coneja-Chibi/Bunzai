/**
 * Create a blank library lorebook. Shared by the Library's "New lorebook" action
 * (apps/library/new-lorebook.ts) and the World wing's "+ New Lorebook" row (2e-d7 plan step 1): same
 * empty body factory, same save call, so the two doors to a blank book can never drift apart.
 */
import type { AppContext, StudioEntitySummary } from "../app-contract";
import { emptyLorebookBody } from "../../core/lore";
import { createAndOpenPiece } from "../apps/library/new-piece";

export async function createLorebook(ctx: AppContext, name = "Untitled lorebook"): Promise<StudioEntitySummary> {
  return createAndOpenPiece(ctx, "lorebook", "lorebook", emptyLorebookBody(name));
}
