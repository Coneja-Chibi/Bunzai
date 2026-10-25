/**
 * Writes what a book-rewriting pass staged as receipted, revision-checked patches through the one book writer (04b D5; shared by
 * Standardize and Refine during a tree build): one receipt per fit of the receipt budget, a source the book changed under is
 * reported and not written, a source the receipt had no room for goes to the next receipt, and a patch that landed without its
 * receipt is said and not hidden. Nothing is written once the run is stopped. Callers run it in the scene's lane.
 */
import { toErrorMessage } from "../error-message";
import type { PassStage, StdOutcome } from "../core/compendium";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { ReceiptKind, ReceiptWrite } from "../stage/contracts/chat-receipt-types";
import type { CompendiumDeps } from "./compendium-deps";
import { writeBook } from "./world-book-writer";

/** A receipt holds 64 KiB of UTF-8 JSON (65,536 bytes); writes take at most this, leaving room for the model name and a reason of up to 1,500 characters (6,000 bytes). */
export const RECEIPT_BUDGET = 56_000;
const REASON_MAX = 1_500;
export const bounded = (text: string): string => (text.length > REASON_MAX ? `${text.slice(0, REASON_MAX - 1)}...` : text);

/** What a commit needs of its run: the scene, the book, the signal, and where to report. */
export interface CommitContext {
  deps: CompendiumDeps;
  chatId: string;
  branchId: string;
  bookId: string;
  signal: AbortSignal;
  log(level: "info" | "warn" | "error", text: string): void;
  /** Reports the outcomes of one receipt's worth of sources. */
  landed(outcomes: readonly StdOutcome[], typed: Readonly<Record<string, number>>): void;
}

export interface CommitSpec<S extends { entry: LorebookEntry }> {
  kind: ReceiptKind;
  /** Stages the queue against the book as the writer holds it, and again on a rebase. */
  stage(entries: readonly LorebookEntry[], queue: readonly S[], receiptId: string): PassStage<S>;
  /** What a landed source is called in the receipt's note: "converted", "refined". */
  done: string;
  /** Said when written entries have no receipt. */
  lost: string;
}

export async function commitStaged<S extends { entry: LorebookEntry }>(c: CommitContext, spec: CommitSpec<S>, sources: readonly S[], model: string): Promise<void> {
  let queue = [...sources];
  while (queue.length > 0 && !c.signal.aborted) {
    const receipt = await c.deps.chats.appendReceipt(c.chatId, { branchId: c.branchId, kind: spec.kind, status: "running", model });
    if (!receipt) throw new Error("the scene is gone");
    let staged: PassStage<S> | undefined;
    const settle = (status: "filed" | "nothing_to_file" | "failed", extra: { writes?: ReceiptWrite[]; reason?: string }) =>
      c.deps.chats.settleReceipt(receipt.id, { status, model, ...(extra.writes ? { writes: extra.writes } : {}), ...(extra.reason ? { reason: bounded(extra.reason) } : {}) });
    const failedAll = (why: string): StdOutcome[] => queue.map((s) => ({ entryId: s.entry.id, title: s.entry.title, result: "failed", reason: why, created: 0, dedup: 0 }));
    let result;
    try {
      result = await writeBook(c.deps.store, c.bookId, (entries) => {
        staged = spec.stage(entries, queue, receipt.id);
        return staged.entries;
      });
    } catch (error) {
      const why = toErrorMessage(error, "the book could not be written");
      await settle("failed", { reason: why });
      c.landed(failedAll(why), {});
      return;
    }
    if (result.status === "conflict" || result.status === "missing") {
      const why = result.status === "missing" ? "the book is gone" : "the book changed under these entries while they were being written, so nothing was written; run it again";
      await settle("failed", { reason: why });
      c.landed(failedAll(why), {});
      return;
    }
    const stage = staged!;
    const failed = stage.outcomes.filter((o) => o.result === "failed");
    const note = [`${stage.outcomes.length - failed.length} ${spec.done}`, ...(failed.length > 0 ? [`${failed.length} left as written: ${failed.slice(0, 5).map((o) => `${o.title} (${o.reason})`).join("; ")}`] : [])].join(", ");
    try {
      if (result.status === "saved") await settle("filed", { writes: stage.writes, reason: failed.length > 0 ? note : "" });
      else await settle("nothing_to_file", { reason: note });
    } catch (error) {
      // Not expected (the stage keeps writes under the cap), but a patch that landed without its receipt must be said, not hidden.
      const why = toErrorMessage(error, "the receipt could not be saved");
      c.log("error", `${spec.lost}: ${why}`);
      await settle("failed", { reason: `written, but the receipt could not be saved: ${why}` }).catch(() => undefined);
    }
    c.landed(stage.outcomes, stage.typed);
    queue = [...stage.deferred];
  }
}
