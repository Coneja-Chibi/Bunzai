/**
 * Create a blank lorebook in the studio and return a summary for the workbench. The empty-book
 * factory and save call live in src/ui/_shared/create-lorebook.ts, shared with the World wing's
 * "+ New Lorebook" row (2e-d7 plan step 1).
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { createLorebook } from "../../_shared/create-lorebook";

export async function createAndOpenLorebook(ctx: AppContext): Promise<StudioEntitySummary> {
  return createLorebook(ctx);
}
