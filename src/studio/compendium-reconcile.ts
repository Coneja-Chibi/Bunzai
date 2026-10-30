/**
 * Reconcile's two actions through the one book writer (04b C7, F1): MIRROR and KEEP are each a revision-checked patch of the book
 * and a `mirror` receipt with the values Undo needs, so neither is an unversioned write. The book must allow the Compendium to
 * write (the same rule as filing). A request for many pairs is one patch and one receipt, so one Undo takes them all back.
 * Callers run these in the scene's lane.
 */
import { canWrite, keepPairs, mirrorPairs, pairKey, reconcileRows, type PairState, type ReconcilePair, type ReconcileRow } from "../core/compendium";
import type { CompendiumReceipt } from "../stage/contracts/chat-store";
import { StudioConflictError, StudioNotFoundError } from "./errors";
import { sceneBooks, type CompendiumDeps } from "./compendium-deps";

import { writeBook } from "./world-book-writer";

const BUDGET = 48_000;

export interface ReconcileResult {
  receipt: CompendiumReceipt | null;
  /** Per requested pair: done, no longer one-sided, or failed (the book changed under it). */
  states: Record<string, PairState | "failed">;
}

/** The one-sided relationships of a book this scene reads, minus the ones the person kept. */
export async function reconcileList(deps: CompendiumDeps, chatId: string, bookId: string): Promise<ReconcileRow[]> {
  const book = (await sceneBooks(deps, chatId))?.books.find((b) => b.id === bookId);
  if (!book) throw new StudioNotFoundError("that book is not one this scene reads");
  return reconcileRows(book.entries);
}

export async function reconcileApply(deps: CompendiumDeps, chatId: string, bookId: string, action: "mirror" | "keep", pairs: readonly ReconcilePair[]): Promise<ReconcileResult> {
  const scene = await sceneBooks(deps, chatId);
  const book = scene?.books.find((b) => b.id === bookId);
  if (!scene || !book) throw new StudioNotFoundError("that book is not one this scene reads");
  if (!canWrite(book.access)) throw new StudioConflictError("this book is read only for the Compendium; allow it to write in the scene's Books first");
  const receipt = (await deps.chats.appendReceipt(chatId, { branchId: scene.chat.activeBranchId, kind: "mirror", status: "running" }))!;
  let last: ReturnType<typeof mirrorPairs> | undefined;
  try {
    const result = await writeBook(deps.store, bookId, (entries) => {
      last = (action === "mirror" ? mirrorPairs : keepPairs)(entries, bookId, pairs);
      if (JSON.stringify(last.writes).length > BUDGET) throw new StudioConflictError("that is more than one receipt can record; reconcile a smaller group at a time");
      return last.entries;
    });
    const states: ReconcileResult["states"] = {};
    for (const p of pairs) states[pairKey(p)] = result.status === "saved" || result.status === "unchanged" ? last?.states.get(pairKey(p)) ?? "failed" : "failed";
    if (result.status === "saved" && last) {
      return { receipt: (await deps.chats.settleReceipt(receipt.id, { status: "filed", writes: last.writes }))!, states };
    }
    if (result.status === "unchanged") return { receipt: (await deps.chats.settleReceipt(receipt.id, { status: "nothing_to_file", reason: "every pair was already reconciled" }))!, states };
    return { receipt: (await deps.chats.settleReceipt(receipt.id, { status: "failed", reason: result.status === "conflict" ? "the book changed while reconciling, so nothing was written; try again" : "the book is gone" }))!, states };
  } catch (error) {
    await deps.chats.settleReceipt(receipt.id, { status: "failed", reason: error instanceof Error ? error.message.slice(0, 500) : "reconcile failed" }).catch(() => undefined);
    throw error;
  }
}
