/**
 * The Compendium's model-driven half of the app contract's `api` (src/ui/server-chats-compendium-ai.ts): the stored tree layout and
 * the calls that build, move in and take back one. The page never builds a layout itself and nothing here patches a book.
 */
import type { StoredTree } from "../stage/contracts/chat-store";
import type { IngestRun } from "../studio/compendium-ingest";

export interface CompendiumAiApi {
  /** The book's newest live layout, or null when it has none and the page shows the derived tree. */
  getCompendiumTree(chatId: string, bookId: string): Promise<{ tree: StoredTree | null }>;
  /** Builds a layout with the Compendium's model and stores it; `notes` names anything the build had to repair. Takes as long as the model does. */
  buildCompendiumTree(chatId: string, bookId: string): Promise<{ tree: StoredTree; notes: string[] }>;
  /** Takes back the newest layout; `current` is the one that shows now, or null for the derived tree. */
  undoCompendiumTree(chatId: string, bookId: string): Promise<{ undone: boolean; current: StoredTree | null }>;
  /** Files an entry under a branch of the built tree, as a new layout Undo can take back. Refused when no tree is built. */
  moveCompendiumEntry(chatId: string, bookId: string, entryId: string, nodeId: string): Promise<{ tree: StoredTree }>;
  /** How many messages the scene's take holds, and the newest Import chat history run for it (null before any). */
  getCompendiumIngest(chatId: string): Promise<{ total: number; run: IngestRun | null }>;
  /** Starts a run over live messages `from` up to `to` (exclusive) into the book and answers at once; poll `getCompendiumIngest`. Refused with a reason when the book cannot be written or the range is bad. */
  startCompendiumIngest(chatId: string, bookId: string, from: number, to: number): Promise<{ run: IngestRun }>;
  cancelCompendiumIngest(chatId: string, runId: string): Promise<{ cancelled: boolean }>;
  /** Takes back every chunk the run filed, newest first. */
  undoCompendiumIngest(chatId: string, runId: string): Promise<{ undone: number; failed: string[] }>;
}
