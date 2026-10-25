/**
 * The Compendium's receipt half of the app contract's `api` (src/ui/server-chats-compendium.ts): the scene's receipts for
 * Activity, Undo, File again, Clear feed and Reconcile. Every book change is made on the server through the one book writer;
 * nothing here patches a book from the page (04b F1).
 */
import type { CompendiumReceipt } from "../stage/contracts/chat-store";
import type { PairState, ReconcilePair, ReconcileRow, RevertResult, RunSnapshot, StartRequest } from "../core/compendium";

export interface CompendiumApi {
  /** The scene's Standardize runs (running or finished and not dismissed) and, per book, how many Standardize receipts Revert would take back. */
  standardizeStatus(chatId: string): Promise<{ runs: RunSnapshot[]; /** Left out while a run works. */ revertable?: Record<string, number> }>;
  /** Starts a run on a book in the background; rejects with the reason in words when the book cannot be standardized now. */
  startStandardize(chatId: string, bookId: string, request: StartRequest): Promise<{ run: RunSnapshot }>;
  /** Stops a running run at the next safe point; what it already wrote stays receipted. */
  cancelStandardize(chatId: string, bookId: string): Promise<{ run: RunSnapshot }>;
  /** Forgets a finished run's summary card. */
  dismissStandardize(chatId: string, bookId: string): Promise<{ dismissed: boolean }>;
  /** Takes back every Standardize write still in effect on the book, from the receipts. */
  revertStandardize(chatId: string, bookId: string): Promise<RevertResult>;
  /** A library book as RoleCall's compendium file, streamed: drain it to a Blob and save that, never read it whole. */
  exportCompendium(bookId: string): Promise<Response>;
  /** The scene's receipts, newest first, with the Clear feed watermark (a receipt older than it is hidden by the page, never deleted). */
  listCompendiumReceipts(chatId: string, page?: { branchId?: string; before?: string; limit?: number }): Promise<{ receipts: CompendiumReceipt[]; feedClearedAt: number }>;
  /** Takes back a filing or mirror receipt; answers the undo receipt (an entry edited since is skipped and named in its reason). */
  undoCompendiumReceipt(chatId: string, receiptId: string): Promise<CompendiumReceipt>;
  /** Files a reply again, as a new pass. */
  fileCompendiumAgain(chatId: string, receiptId: string): Promise<CompendiumReceipt>;
  /** Hides the feed up to now. */
  clearCompendiumFeed(chatId: string): Promise<{ feedClearedAt: number }>;
  /** The one-sided relationships of a book the scene reads. */
  listCompendiumReconcile(chatId: string, bookId: string): Promise<{ rows: ReconcileRow[] }>;
  /** MIRROR or KEEP for these pairs, as one patch and one receipt. */
  reconcileCompendium(chatId: string, bookId: string, action: "mirror" | "keep", pairs: ReconcilePair[]): Promise<{ receipt: CompendiumReceipt | null; states: Record<string, PairState | "failed"> }>;
}
