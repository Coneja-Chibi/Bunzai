/**
 * What the Compendium's two book-rewriting passes share (Standardize, and Refine during a tree build): the working copy of a book that
 * a source's changes can be taken back from, the size a receipt holds, and the loop that stages sources one at a time against the
 * receipt's budget (04b D5, F2, F3). A pass supplies how one source is staged; this keeps the book indexed once (position by id, typed
 * entries by name), rolls a failed source back whole, defers a source the receipt has no room for, and fails alone one that could never
 * fit. Pure: it is run by the book writer inside its revision-checked read and run again on a rebase.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { ReceiptWrite } from "../../stage/contracts/chat-receipt-types";
import { readEntry } from "./read";
import { normalizeName } from "./relationships";
import { entryNames } from "./snapshot";
import type { EntryType } from "./types";

export interface StdOutcome {
  entryId: string;
  title: string;
  result: "rewritten" | "consumed" | "failed";
  reason?: string;
  created: number;
  dedup: number;
  /** The ids of the entries this source made (splits). */
  made?: string[];
}

export interface StdOptions { bookId: string; receiptId: string; newId: () => string; now: number; budgetBytes: number }

/** What a pass staged for the receipt: the book's next entries, the writes that give them back, and what became of each source. */
export interface PassStage<S> {
  entries: LorebookEntry[];
  writes: ReceiptWrite[];
  outcomes: StdOutcome[];
  /** Sources the receipt had no room for; stage them again into the next receipt. */
  deferred: S[];
  typed: Record<string, number>;
  bytes: number;
}

/** What the store caps a receipt by: UTF-8 bytes of its JSON, which is three times the characters for Japanese. */
export const size = (writes: readonly ReceiptWrite[]): number => new TextEncoder().encode(JSON.stringify(writes)).length;
const keyOf = (type: EntryType, name: string): string => `${type}\u0000${name}`;

/** The working book: entries in place, their positions, and the live typed entries by (type, name, title or alias). Changes to it are logged so a source can be taken back whole. */
export class Book {
  readonly entries: LorebookEntry[];
  private readonly at = new Map<string, number>();
  private readonly typed = new Map<string, string>();
  private log: { index: number; prev: LorebookEntry | undefined }[] = [];
  private keys: string[] = [];

  constructor(entries: readonly LorebookEntry[]) {
    this.entries = [...entries];
    this.entries.forEach((e, i) => { this.at.set(e.id, i); this.index(e, i); });
    this.log = [];
    this.keys = [];
  }

  private index(entry: LorebookEntry, i: number): void {
    const view = readEntry(entry, i);
    if (view.type === null || view.retired || !view.enabled) return;
    for (const n of entryNames(view)) {
      const key = keyOf(view.type, n);
      if (!this.typed.has(key)) { this.typed.set(key, entry.id); this.keys.push(key); }
    }
  }

  get(id: string): LorebookEntry | undefined { const i = this.at.get(id); return i === undefined ? undefined : this.entries[i]; }

  put(next: LorebookEntry): void {
    const i = this.at.get(next.id)!;
    this.log.push({ index: i, prev: this.entries[i] });
    this.entries[i] = next;
    this.index(next, i);
  }

  add(entry: LorebookEntry): void {
    this.log.push({ index: this.entries.length, prev: undefined });
    this.at.set(entry.id, this.entries.length);
    this.entries.push(entry);
    this.index(entry, this.entries.length - 1);
  }

  /** The live typed entry of this type that answers to the name or an alias. */
  match(type: EntryType, name: string, aliases: readonly string[]): LorebookEntry | undefined {
    for (const n of [name, ...aliases].map(normalizeName)) {
      const id = n ? this.typed.get(keyOf(type, n)) : undefined;
      const found = id === undefined ? undefined : this.get(id);
      if (found && readEntry(found, 0).type === type) return found;
    }
    return undefined;
  }

  /** Starts a source: what changes from here can be undone with `rollback`. */
  begin(): void { this.log = []; this.keys = []; }

  rollback(): void {
    for (const { index, prev } of this.log.reverse()) {
      if (prev) this.entries[index] = prev;
      else { this.at.delete(this.entries[index]!.id); this.entries.length = index; }
    }
    for (const key of this.keys) this.typed.delete(key);
  }
}

/** One source staged: its writes, what became of it and the entry types it produced, or why it was left as written. */
export type Staged = { ok: true; writes: ReceiptWrite[]; outcomes: StdOutcome[]; typed: string[] } | { ok: false; reason: string };

export function stageAll<S extends { entry: LorebookEntry }>(entries: readonly LorebookEntry[], sources: readonly S[], o: StdOptions, stageOne: (book: Book, src: S, o: StdOptions) => Staged, what: string): PassStage<S> {
  const book = new Book(entries);
  const out: PassStage<S> = { entries: book.entries, writes: [], outcomes: [], deferred: [], typed: {}, bytes: 0 };
  const fail = (src: S, reason: string): void => void out.outcomes.push({ entryId: src.entry.id, title: src.entry.title, result: "failed", reason, created: 0, dedup: 0 });
  for (const src of sources) {
    const staged = stageOne(book, src, o);
    if (!staged.ok) { fail(src, staged.reason); continue; }
    const cost = size(staged.writes);
    if (out.bytes + cost > o.budgetBytes) {
      book.rollback();
      if (cost > o.budgetBytes) fail(src, `its ${what} is larger than one receipt holds, so it was left as written`);
      else out.deferred.push(src);
      continue;
    }
    out.bytes += cost;
    out.writes.push(...staged.writes);
    out.outcomes.push(...staged.outcomes);
    for (const t of staged.typed) out.typed[t] = (out.typed[t] ?? 0) + 1;
  }
  return out;
}
