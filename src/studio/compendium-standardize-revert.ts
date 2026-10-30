/**
 * REVERT (RoleCall `standardize/revert/route.ts`; 04b F2, F3): takes back every Standardize write still in effect on a book by undoing
 * its receipts, newest first (a later batch may have merged into an entry an earlier one made). One undo system: the receipts that
 * recorded the writes are the only record, and nothing was stamped into the book to find them by. Each source gets back exactly the
 * text and fields it had; an entry made by the run (a split) is retired, never deleted; a source the run retired is brought back; an
 * entry the person or a filing pass changed since is left as it is and named. A receipt is marked undone only when all of its writes
 * landed, so a partial revert can be run again. Callers run this in the scene's lane.
 */
import { toErrorMessage } from "../error-message";
import { isActive, type RevertResult } from "../core/compendium";
import type { CompendiumReceipt } from "../stage/contracts/chat-store";
import { StudioConflictError } from "./errors";
import type { CompendiumDeps } from "./compendium-deps";
import { runOf } from "./compendium-standardize";
import { undoableReceipts, undoReceipt } from "./compendium-undo";

/** The Standardize receipts of a book (of every book with none named) that Revert would take back, newest first. */
export const revertable = (deps: CompendiumDeps, chatId: string, bookId?: string): Promise<CompendiumReceipt[]> =>
  undoableReceipts(deps, chatId, undefined, (r) => bookId === undefined || r.writes.some((w) => w.bookId === bookId), ["standardize"]);

export async function revertStandardization(deps: CompendiumDeps, chatId: string, bookId: string): Promise<RevertResult> {
  const live = runOf(chatId, bookId);
  if (live && isActive(live)) throw new StudioConflictError("Standardization is running; stop it or wait for it to finish before reverting.");
  const out: RevertResult = { receipts: 0, rewrites: 0, merges: 0, splits: 0, consumed: 0, skipped: [] };
  for (const r of await revertable(deps, chatId, bookId)) {
    try {
      const undo = await undoReceipt(deps, chatId, r.id);
      if (undo.status !== "filed") { out.skipped.push(undo.reason ?? "some entries could not be restored"); continue; }
      out.receipts += 1;
      for (const w of r.writes.filter((x) => x.bookId === bookId)) {
        if (w.op === "create") out.splits += 1;
        else if (w.op === "retire") out.consumed += 1;
        else if ("type" in w.fields.after) out.rewrites += 1;
        else out.merges += 1;
      }
    } catch (error) {
      out.skipped.push(toErrorMessage(error, "a receipt could not be undone"));
    }
  }
  return out;
}
