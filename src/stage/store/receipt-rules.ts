/**
 * The input checks and the status machine for Compendium receipts, applied by every
 * ChatStore implementation. The 64 KB cap is measured on the plaintext JSON so memory and SQLite refuse the same receipt.
 */
import { StudioConflictError } from "../../studio/errors";
import { isOneOf, isPlainObject, type Rec } from "../../core/guards";
import {
  RECEIPT_KINDS, RECEIPT_MAX_BYTES, RECEIPT_OPS, RECEIPT_STATUSES,
  type CompendiumReceipt, type ReceiptInput, type ReceiptSettle, type ReceiptStatus, type ReceiptWrite,
} from "../contracts/chat-receipt-types";
import { checkText, fail, isJson } from "./chat-rules";
import { checkWhole } from "./scalar-rules";

const LIMIT_MAX = 200;
const LIMIT_DEFAULT = 50;

/** Where each status may go. `filed` and `partly_filed` may be undone; nothing in flight blocks anything else. */
const NEXT: Readonly<Record<ReceiptStatus, readonly ReceiptStatus[]>> = {
  queued: ["running", "skipped", "failed", "interrupted"],
  running: ["filed", "partly_filed", "nothing_to_file", "skipped", "failed", "interrupted"],
  filed: ["undone"],
  partly_filed: ["undone"],
  nothing_to_file: [],
  skipped: [],
  failed: [],
  interrupted: [],
  undone: [],
};

const id = (v: unknown, what: string): string => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : fail(`${what} must be 1 to 200 characters`));
const optId = (v: unknown, what: string): string | undefined => (v === undefined ? undefined : id(v, what));
const status = (v: unknown): ReceiptStatus => (isOneOf(v, RECEIPT_STATUSES) ? v : fail("unknown receipt status"));

function checkWrites(value: unknown): ReceiptWrite[] {
  if (!Array.isArray(value)) return fail("writes must be a list");
  return value.map((w: unknown) => {
    if (!isPlainObject(w)) return fail("a write must be a plain object");
    for (const key of Object.keys(w)) if (!["bookId", "entryId", "op", "fields"].includes(key)) fail(`a write has an unknown field: ${key}`);
    if (!isOneOf(w.op, RECEIPT_OPS)) fail("a write op must be create, update, retire or mirror");
    const fields = w.fields;
    if (!isPlainObject(fields) || Object.keys(fields).some((k) => k !== "before" && k !== "after")) fail("a write needs fields { before, after }");
    if (!isPlainObject(fields.before) || !isPlainObject(fields.after) || !isJson(fields.before) || !isJson(fields.after)) fail("a write's before and after must be JSON objects");
    return { bookId: id(w.bookId, "a write bookId"), entryId: id(w.entryId, "a write entryId"), op: w.op, fields: structuredClone({ before: fields.before, after: fields.after }) } as ReceiptWrite;
  });
}

/** Refuses a receipt whose JSON is over the cap; a pass that needs more stores a marker and the entry's own text. */
export function requireReceiptSize(body: Rec): void {
  if (new TextEncoder().encode(JSON.stringify(body)).length > RECEIPT_MAX_BYTES) fail(`a receipt must hold at most ${RECEIPT_MAX_BYTES} bytes of JSON`);
}

/** The fields of `appendReceipt`, checked; the caller adds id and times. */
export function checkReceiptInput(value: unknown): Required<Pick<ReceiptInput, "branchId" | "kind" | "status" | "writes">> & Omit<ReceiptInput, "status" | "writes"> {
  if (!isPlainObject(value)) return fail("a receipt must be a plain object");
  for (const key of Object.keys(value)) if (!["branchId", "messageId", "swipeId", "kind", "status", "model", "undoes", "reason", "writes"].includes(key)) fail(`a receipt has an unknown field: ${key}`);
  if (!isOneOf(value.kind, RECEIPT_KINDS)) fail("unknown receipt kind");
  const out = {
    branchId: id(value.branchId, "branchId"), kind: value.kind, status: value.status === undefined ? "queued" as const : status(value.status),
    writes: value.writes === undefined ? [] : checkWrites(value.writes),
    ...(value.messageId === undefined ? {} : { messageId: id(value.messageId, "messageId") }),
    ...(value.swipeId === undefined ? {} : { swipeId: id(value.swipeId, "swipeId") }),
    ...(value.model === undefined ? {} : { model: checkText(value.model, "model") }),
    ...(value.undoes === undefined ? {} : { undoes: id(value.undoes, "undoes") }),
    ...(value.reason === undefined ? {} : { reason: checkText(value.reason, "reason") }),
  };
  return out;
}

export function checkSettle(value: unknown): ReceiptSettle {
  if (!isPlainObject(value)) return fail("a settle must be a plain object");
  for (const key of Object.keys(value)) if (!["status", "reason", "writes", "model", "undoneBy"].includes(key)) fail(`a settle has an unknown field: ${key}`);
  return {
    status: status(value.status),
    ...(value.reason === undefined ? {} : { reason: checkText(value.reason, "reason") }),
    ...(value.writes === undefined ? {} : { writes: checkWrites(value.writes) }),
    ...(value.model === undefined ? {} : { model: checkText(value.model, "model") }),
    ...(optId(value.undoneBy, "undoneBy") === undefined ? {} : { undoneBy: value.undoneBy as string }),
  };
}

/** Whether `from` may become `to`. An undone receipt asked to be undone again is a no-op, not an error (F4). */
export function settleKind(from: ReceiptStatus, to: ReceiptStatus): "move" | "same" {
  if (from === "undone" && to === "undone") return "same";
  if (!NEXT[from].includes(to)) throw new StudioConflictError(`a ${from} receipt cannot become ${to}`);
  return "move";
}

export function checkReceiptPage(page: { branchId?: string; messageId?: string; before?: string; limit?: number } | undefined): { branchId?: string; messageId?: string; before?: string; limit: number } {
  return {
    ...(page?.branchId === undefined ? {} : { branchId: id(page.branchId, "branchId") }),
    ...(page?.messageId === undefined ? {} : { messageId: id(page.messageId, "messageId") }),
    ...(page?.before === undefined ? {} : { before: id(page.before, "before") }),
    limit: page?.limit === undefined ? LIMIT_DEFAULT : checkWhole(page.limit, `limit must be a whole number from 1 to ${LIMIT_MAX}`, 1, LIMIT_MAX),
  };
}

/** The part of a receipt the SQLite store seals in one cell, and the part the size cap measures. */
export const receiptBody = (r: CompendiumReceipt): Rec => ({
  writes: r.writes,
  ...(r.model === undefined ? {} : { model: r.model }), ...(r.undoes === undefined ? {} : { undoes: r.undoes }),
  ...(r.undoneBy === undefined ? {} : { undoneBy: r.undoneBy }), ...(r.reason === undefined ? {} : { reason: r.reason }),
});

/** The receipt after a checked settle; the same receipt when an undone one is undone again. */
export function applySettle(r: CompendiumReceipt, s: ReceiptSettle, now: number): CompendiumReceipt {
  if (settleKind(r.status, s.status) === "same") return r;
  const next: CompendiumReceipt = {
    ...r, status: s.status, settledAt: now,
    ...(s.reason === undefined ? {} : { reason: s.reason }), ...(s.writes === undefined ? {} : { writes: s.writes }),
    ...(s.model === undefined ? {} : { model: s.model }), ...(s.undoneBy === undefined ? {} : { undoneBy: s.undoneBy }),
  };
  requireReceiptSize(receiptBody(next));
  return next;
}
