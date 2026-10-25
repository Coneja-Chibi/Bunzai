/** Shared mutation ledger and bounded composite history for immutable editor drafts. */
import { deepEqual } from "./editor-patch";
import { applyPiecePatch, buildPiecePatch } from "./editor-patch";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { PiecePatch } from "../../stage/contracts/content-store";
import { encodeNamePart } from "../../entities/piece-parts";

const overlaps = (a: string, b: string): boolean => a === "document" || b === "document" || a === b || a.startsWith(`${b}:`) || a.startsWith(`${b}.`) || b.startsWith(`${a}:`) || b.startsWith(`${a}.`);

export interface EditorTouch<T> {
  key: string;
  read(body: T): unknown;
  write?(body: T, value: unknown): T;
  items?(body: T): Record<string, unknown>;
}

export interface EditorHistoryChange<T, Native = never> {
  touch?: EditorTouch<T>;
  value?: unknown;
  patch?: PiecePatch;
  native?: Native;
}

/** Occurrence names and positions are rebuilt only when item structure changes. */
export class OccurrenceIndex<T> {
  #positions = new Map<string, number[]>();
  #names = new Map<number, string>();

  rebuild(items: readonly T[], idOf: (item: T) => string): void {
    this.#positions.clear();
    this.#names.clear();
    items.forEach((item, index) => {
      const id = idOf(item);
      const positions = this.#positions.get(id) ?? [];
      positions.push(index);
      this.#positions.set(id, positions);
      const encoded = `i/${encodeNamePart(id)}`;
      this.#names.set(index, `${encoded}${positions.length === 1 ? "" : `#${positions.length}`}`);
    });
  }

  positions(id: string): readonly number[] { return this.#positions.get(id) ?? []; }
  nameAt(index: number): string | undefined { return this.#names.get(index); }
}

export function editorHistoryChanges<T, Native = never>(
  before: T,
  after: T,
  touch: EditorTouch<T> | undefined,
  kind: ParsedCanonicalEntity["kind"],
  id: string,
  nativeBefore?: Native,
  nativeAfter?: Native,
): [EditorHistoryChange<T, Native>, EditorHistoryChange<T, Native>] {
  const priorNative = nativeBefore === undefined ? {} : { native: nativeBefore };
  const nextNative = nativeAfter === undefined ? {} : { native: nativeAfter };
  if (touch?.write) return [
    { touch, value: touch.read(before), ...priorNative }, { touch, value: touch.read(after), ...nextNative },
  ];
  if (before === after) return [{ ...priorNative }, { ...nextNative }];
  const prior = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id, body: before } as unknown as ParsedCanonicalEntity;
  const next = { ...prior, body: after } as unknown as ParsedCanonicalEntity;
  return [
    { patch: buildPiecePatch(next, prior), ...priorNative }, { patch: buildPiecePatch(prior, next), ...nextNative },
  ];
}

export function applyEditorHistoryChange<T, Native = never>(
  body: T,
  change: EditorHistoryChange<T, Native>,
  kind: ParsedCanonicalEntity["kind"],
  id: string,
): T {
  if (change.touch?.write) return change.touch.write(body, change.value);
  if (!change.patch) return body;
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id, body } as unknown as ParsedCanonicalEntity;
  return applyPiecePatch(entity, change.patch).body as T;
}

function retainedBytes(value: unknown, seen = new Set<object>()): number {
  if (typeof value === "string") return value.length * 2;
  if (value === null || typeof value !== "object") return 16;
  if (seen.has(value)) return 8;
  seen.add(value);
  if (Array.isArray(value)) return 24 + value.reduce((bytes, item) => bytes + retainedBytes(item, seen), 0);
  return 40 + Object.entries(value).reduce((bytes, [key, item]) => bytes + key.length * 2 + retainedBytes(item, seen), 0);
}

/** One per-editor ledger owns dirty provenance, pending-save touches, and its composite undo tape. */
export class EditorMutationLedger<T, Native = never> {
  readonly history = new BoundedEditorHistory<EditorHistoryChange<T, Native>>();
  #baseline: T;
  #touches = new Map<string, EditorTouch<T>>();
  #submitted = new Set<{ revision: number; keys: Set<string>; structural: boolean }>();
  #structural = false;
  #structuralRevision = 0;

  constructor(initial: T) { this.#baseline = initial; }
  get dirty(): boolean { return this.#structural || this.#touches.size > 0; }
  get structural(): boolean { return this.#structural; }
  get baseline(): T { return this.#baseline; }
  hasTouch(key: string): boolean { return this.#touches.has(key); }
  hasPending(key: string): boolean { return this.#hasPending(key); }
  hasTouchWithin(key: string): boolean { return [...this.#touches.keys()].some((part) => part === key || part.startsWith(`${key}:`) || part.startsWith(`${key}.`)); }
  hasPendingWithin(key: string): boolean { return [...this.#submitted.values()].some(({ keys }) => [...keys].some((part) => part === key || part.startsWith(`${key}:`) || part.startsWith(`${key}.`))); }
  hasTouchOverlapping(key: string): boolean { return this.#structural || [...this.#touches.keys()].some((part) => overlaps(key, part)); }
  hasPendingOverlapping(key: string): boolean { return [...this.#submitted].some(({ keys, structural }) => structural || [...keys].some((part) => overlaps(key, part))); }

  hydrateBaseline(touch: EditorTouch<T>, value: unknown): void {
    if (touch.write) this.#baseline = touch.write(this.#baseline, value);
  }

  partItems(body: T): Record<string, unknown> {
    const items: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const touch of this.#touches.values()) Object.assign(items, touch.items?.(body));
    return items;
  }

  track(body: T, touch: EditorTouch<T> | undefined, revision: number, reconcile = false): void {
    if (touch) {
      const equal = deepEqual(touch.read(body), touch.read(this.#baseline));
      const pending = this.#hasPending(touch.key);
      if (equal && !pending) this.#touches.delete(touch.key);
      else this.#touches.set(touch.key, touch);
    } else {
      this.#structural = !deepEqual(body, this.#baseline) || this.#hasPendingStructural();
      this.#structuralRevision = this.#structural ? revision : 0;
    }
    if (reconcile) {
      for (const [key, part] of this.#touches) {
        if (deepEqual(part.read(body), part.read(this.#baseline)) && !this.#hasPending(key)) this.#touches.delete(key);
      }
      if (this.#structural || this.#hasPendingStructural()) {
        this.#structural = !deepEqual(body, this.#baseline) || this.#hasPendingStructural();
        this.#structuralRevision = this.#structural ? revision : 0;
      }
    }
  }

  #hasPending(key: string): boolean { return [...this.#submitted.values()].some(({ keys }) => keys.has(key)); }
  #hasPendingStructural(): boolean { return [...this.#submitted.values()].some(({ structural }) => structural); }

  markOverwrite(revision: number): void {
    this.#structural = true;
    this.#structuralRevision = Math.max(this.#structuralRevision, revision);
    for (const submission of this.#submitted) if (submission.revision === revision) submission.structural = true;
  }

  beginSubmit(revision: number): ((current: T) => void) & { promote(): void } {
    const submission = { revision, keys: new Set(this.#touches.keys()), structural: this.#structural };
    this.#submitted.add(submission);
    return Object.assign((current: T) => {
      if (!this.#submitted.delete(submission)) return;
      for (const [key, touch] of this.#touches) {
        if (!this.#hasPending(key) && deepEqual(touch.read(current), touch.read(this.#baseline))) this.#touches.delete(key);
      }
      if (this.#structural) {
        this.#structural = this.#hasPendingStructural() || !deepEqual(current, this.#baseline);
        if (!this.#structural) this.#structuralRevision = 0;
      }
    }, { promote: () => { submission.structural = true; } });
  }

  accept(submitted: T, current: T, atRevision: number): void {
    this.#baseline = submitted;
    for (const [key, touch] of this.#touches) {
      if (!this.#hasPending(key) && deepEqual(touch.read(current), touch.read(submitted))) this.#touches.delete(key);
    }
    const capturedStructural = [...this.#submitted].some((entry) => entry.revision === atRevision && entry.structural);
    this.#structural = Boolean(capturedStructural || this.#structuralRevision > atRevision) && !deepEqual(current, submitted);
    this.#structuralRevision = this.#structural ? Math.max(this.#structuralRevision, atRevision + 1) : 0;
  }

  reseed(body: T): void {
    this.#baseline = body;
    this.#touches.clear();
    this.#submitted.clear();
    this.#structural = false;
    this.#structuralRevision = 0;
    this.history.clear();
  }
}

/** Undo and redo share one physical byte/depth budget; both stacks count toward the cap. */
export class BoundedEditorHistory<T> {
  readonly #limit: number;
  readonly #bytesLimit: number;
  #bytes = 0;
  #undo: { inverse: T; forward: T; bytes: number }[] = [];
  #redo: { inverse: T; forward: T; bytes: number }[] = [];

  constructor(limit = 100, bytesLimit = 8 * 1024 * 1024) { this.#limit = limit; this.#bytesLimit = bytesLimit; }
  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }
  some(predicate: (value: T) => boolean): boolean { return [...this.#undo, ...this.#redo].some(({ inverse, forward }) => predicate(inverse) || predicate(forward)); }

  record(inverse: T, forward: T): void {
    const bytes = retainedBytes(inverse) + retainedBytes(forward);
    this.clearRedo();
    if (bytes > this.#bytesLimit) { this.clear(); return; }
    this.#undo.push({ inverse, forward, bytes });
    this.#bytes += bytes;
    while (this.#undo.length + this.#redo.length > this.#limit || this.#bytes > this.#bytesLimit) {
      const evicted = this.#undo.shift();
      if (!evicted) break;
      this.#bytes -= evicted.bytes;
    }
  }

  undo(): T | undefined {
    const entry = this.#undo.pop();
    if (!entry) return undefined;
    this.#redo.push(entry);
    return entry.inverse;
  }
  redo(): T | undefined {
    const entry = this.#redo.pop();
    if (!entry) return undefined;
    this.#undo.push(entry);
    return entry.forward;
  }
  clearRedo(): void {
    for (const entry of this.#redo) this.#bytes -= entry.bytes;
    this.#redo = [];
  }
  clear(): void { this.#undo = []; this.#redo = []; this.#bytes = 0; }
  clone(): BoundedEditorHistory<T> {
    const copy = new BoundedEditorHistory<T>(this.#limit, this.#bytesLimit);
    copy.#bytes = this.#bytes;
    copy.#undo = [...this.#undo];
    copy.#redo = [...this.#redo];
    return copy;
  }
}
