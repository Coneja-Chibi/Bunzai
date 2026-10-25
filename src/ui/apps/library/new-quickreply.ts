/** Create a blank quick-reply set and return the shared Workbench summary. */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { emptyQuickReplyBody } from "../../../entities/quickreply/schema";
import { createAndOpenPiece } from "./new-piece";

export async function createAndOpenQuickReplies(ctx: AppContext): Promise<StudioEntitySummary> {
  return createAndOpenPiece(
    ctx,
    "quickreply",
    "quick-replies",
    emptyQuickReplyBody("Untitled quick replies"),
  );
}
