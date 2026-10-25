/**
 * Compendium filing receipts: one durable row per pass over a reply, holding the
 * field-level before and after values undo needs. Split from chat-store.ts for the file-size cap; chat-store.ts re-exports.
 */
import type { JsonObject } from "./chat-store";

/** `historian` is the Historian's summaries and arc overviews (Activity phase HIST); `ingest` is one chunk of Import chat history; `standardize` is one Standardize batch; `refine` is one receipt's worth of the splits and merges of Refine entries during a tree build (Activity's "Merged/Split"). */
export const RECEIPT_KINDS = ["filing", "mirror", "undo", "manual", "historian", "ingest", "standardize", "refine"] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

/** Where a pass stands. `queued` and `running` are in flight; the rest are final except `filed`/`partly_filed`, which `undone` can follow. */
export const RECEIPT_STATUSES = ["queued", "running", "filed", "partly_filed", "nothing_to_file", "skipped", "failed", "interrupted", "undone"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_OPS = ["create", "update", "retire", "mirror"] as const;
export type ReceiptOp = (typeof RECEIPT_OPS)[number];

/** One entry a pass touched: the typed fields that changed (`before` for undo, `after` for the guard that skips an entry changed since). */
export interface ReceiptWrite {
  bookId: string;
  entryId: string;
  op: ReceiptOp;
  fields: { before: JsonObject; after: JsonObject };
}

export interface CompendiumReceipt {
  id: string;
  chatId: string;
  branchId: string;
  messageId?: string;
  swipeId?: string;
  kind: ReceiptKind;
  status: ReceiptStatus;
  /** Epoch ms the receipt was appended. */
  at: number;
  /** Epoch ms of the last status change; equals `at` until one happens. */
  settledAt: number;
  model?: string;
  /** For a `undo` receipt: the receipt it reverses. */
  undoes?: string;
  /** For an original receipt an undo has reversed: the undo receipt. */
  undoneBy?: string;
  /** Why a pass was skipped, failed or was interrupted: bounded user-facing text. */
  reason?: string;
  writes: ReceiptWrite[];
  /** Set by a store that could not decode this receipt's sealed cell: the readable columns are true, `writes` is empty, and nothing may settle it. */
  damaged?: true;
}

/** What a caller gives `appendReceipt`; the store assigns `id`, `at` and `settledAt`. */
export interface ReceiptInput {
  branchId: string;
  messageId?: string;
  swipeId?: string;
  kind: ReceiptKind;
  /** Defaults to `queued`. */
  status?: ReceiptStatus;
  model?: string;
  undoes?: string;
  reason?: string;
  writes?: ReceiptWrite[];
}

/** A status change: `status` is required; the rest replace what the receipt held. `undoneBy` is set with `undone`. */
export interface ReceiptSettle {
  status: ReceiptStatus;
  reason?: string;
  writes?: ReceiptWrite[];
  model?: string;
  undoneBy?: string;
}

/** The most UTF-8 bytes of JSON one receipt may hold (writes, reason and the rest); a pass that needs more stores a marker and the entry text instead. */
export const RECEIPT_MAX_BYTES = 64 * 1024;
