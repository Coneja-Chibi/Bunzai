/**
 * The patch path's write-side cache: a bounded, process-local memo of a piece's last decompose, so a warm patch never has to
 * fetch and hash the live parts a whole-entity save would. It is derived, not an authority - every use
 * revalidates against the row's monotonic `writeId` before trusting what it holds - and it
 * holds plaintext, so it is registered with the server cache registry (`src/stage/caches.ts`,
 * `plaintext: true`) and emptied on every lock.
 *
 * MULTIPLE STORES, ONE MAP. `src/stage/caches.ts` registers its core caches once, at module load
 * (mirroring `src/core/tokens`, `src/core/lore/engine`), so this module keeps one module-level Map too
 * rather than a fresh instance per `createContentStore()` call - the registry has nowhere to re-point
 * itself later. Two `ContentStore`s over two different databases (every test file that opens more than
 * one, or two studio roots in one process) can hold the SAME (kind, id, version) with different
 * content, so every entry is namespaced by a per-store token (`newPieceCacheToken()`, called once per
 * `createContentStore`), never by (kind, id) alone.
 *
 * DEEP FREEZE, NOT A CONVENTION. `decompose`'s `reuse` path (`entities/piece-parts.ts`) trusts
 * reference identity: an unchanged item keeps its cached hash only because nothing could have mutated
 * it in place. A cached entity or its parts are frozen, recursively, the moment they are stored, so an
 * in-place mutation from anywhere throws (this file's modules are all ES modules, strict by
 * construction) instead of silently poisoning a future revision.
 */
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { PartRecord } from "../../entities/piece-parts";
import type { PartBlob } from "../../entities/piece-parts-blob";

export interface CachedPiece {
  version: number;
  writeId: number;
  revision: string;
  entity: ParsedCanonicalEntity;
  parts: readonly PartRecord[];
}

/** At most this many pieces held at once, across every store sharing this module. */
const MAX_ENTRIES = 4;
/** At most this many bytes of part json held at once (the plan's own "256 MB of part json"). */
const BUDGET_BYTES = 256 * 1024 * 1024;
/** Flat per-entry bookkeeping estimate, mirroring `core/tokens/base.ts`'s own `ENTRY_OVERHEAD_BYTES`:
 * not a measurement, a deliberately generous number for a Map entry plus its wrapper object. */
const ENTRY_OVERHEAD_BYTES = 256;

/** Insertion-ordered, which is exactly LRU order here: every read re-inserts (`touch`), so the first
 * key is always the least recently used one. */
const cache = new Map<string, CachedPiece>();

/** Open (caching allowed) by default, exactly like `core/tokens/base.ts`'s own `cacheGate`: the browser
 * and every test that never calls `setPieceCacheGate` see today's behavior unchanged. */
let cacheGate: () => boolean = () => true;

/**
 * Registers what decides whether `setCachedPiece` may insert right now (`src/stage/caches.ts`'s
 * `setGate`, the one gate source every plaintext cache shares - wired here so `setGate` closes this
 * cache's gate too). WHY A GATE, NOT ONLY `clearPieceCache` ON LOCK: clearing on lock empties the
 * cache's PAST, but `patchPiece`'s cold fill awaits `backend.parts()` before it ever calls
 * `setCachedPiece` - a lock landing in that gap (`lockAll()` already ran, the cache already emptied)
 * would otherwise let the fill's own insert land moments later with no lock check at all, same race
 * `core/tokens/base.ts`'s own docblock describes for `countText`. Checked at the moment of insert, not
 * at the start of the patch: the patch itself still completes (or fails for its own reasons further
 * down, e.g. the next backend call throwing `LockedError`), but nothing it decoded is ever cached.
 */
export function setPieceCacheGate(gate: () => boolean): void {
  cacheGate = gate;
}

/** Called once after every real insert (never a hit), mirroring the tokens/lore caches' own hook: the
 * registry (`src/stage/caches.ts`) wires this to `notePressure()` so a piece cache fill is one of the
 * events that can trigger an RSS-pressure trim. A no-op until then, so this module needs nothing from
 * the registry to be independently testable. */
let onInsert: () => void = () => {};
export function setPieceCacheInsertHook(hook: () => void): void {
  onInsert = hook;
}

/** A fresh, private namespace within the shared cache: one call per `createContentStore()`, never
 * reused, so two stores (even over the same database, in a test) can never read each other's entry. */
export function newPieceCacheToken(): string {
  return crypto.randomUUID();
}

const keyOf = (token: string, kind: string, id: string): string => `${token}\u0000${kind}\u0000${id}`;

/** Freezes `value` and everything reachable from it, except a typed array (`Object.freeze` throws on
 * a non-empty one - `ArrayBuffer.isView`, true for every `TypedArray`) and anything already frozen
 * (a shared, already-frozen singleton elsewhere in the app is left alone rather than re-walked). Plain
 * objects and arrays only: a `Map`/`Set`'s own mutator methods survive `Object.freeze` on the
 * instance, but nothing this cache holds is one. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value) || ArrayBuffer.isView(value as unknown as ArrayBufferView)) return value;
  Object.freeze(value);
  // Indexed iteration for an array, not `Object.getOwnPropertyNames` (which converts every index to a
  // string): a 3,000-item preset's own prompt array made this the dominant cost of caching a patch
  // result (S5 perf review, 2026-09-30) before this split. An unchanged element is already frozen from
  // a prior patch (`decompose`'s own reuse-by-reference), so `Object.isFrozen` above still turns most
  // of a 3,000-element array into a cheap check rather than a re-walk.
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) deepFreeze(value[i]);
  } else {
    for (const key of Object.getOwnPropertyNames(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** A blob's own decoded payload: the bytes a `kind: "bytes"` blob holds, or the UTF-16 size of a
 * `kind: "text"` blob's string. */
function blobBytes(blob: PartBlob): number {
  return blob.payload.kind === "bytes" ? blob.payload.bytes.byteLength : blob.payload.text.length * 2;
}

/** An estimate, documented like the tokens cache's own: UTF-16 bytes of every part's json, PLUS every
 * blob its own sentinels reference (a part's `json` holds only a short sentinel, never the blob's
 * actual decoded bytes - `piece-parts-blob.ts`'s own split), TRIPLED, plus a flat per-entry overhead.
 * Tripled, not doubled: a freshly cold-filled entry (`coldFillParts`, `content-store-write.ts`) holds
 * the part's own json/sentinel text, PLUS `parts[].value` (coldFillParts's own decode), PLUS
 * `entry.entity`'s own INDEPENDENT decode (`assemble` calls `decodePart` again for every item and
 * escrow raw rather than reusing `parts[].value`) - three copies of the content, not two, until the
 * next patch's `decompose` reuse unifies `entity` and `parts[].value` onto the SAME reference for
 * whatever that patch leaves untouched (`buildNextOriginal`, `content-store-patch.ts`, fixed 2026-10-01
 * to actually preserve that identity). Counting three keeps the estimate on the SAFE side of the 256 MB
 * budget this enforces: undercounting the worst state any entry actually starts in is the wrong
 * direction to round. Deliberately NOT a walk of `entry.entity` itself: that would reintroduce the
 * whole-entity stringify cost this cache exists to let a patch skip, paid again on every single
 * insert. */
function entryBytes(entry: CachedPiece): number {
  let partsAndBlobs = 0;
  for (const p of entry.parts) {
    partsAndBlobs += p.json.length * 2;
    for (const b of p.blobs) partsAndBlobs += blobBytes(b);
  }
  return ENTRY_OVERHEAD_BYTES + partsAndBlobs * 3;
}

function totalBytes(): number {
  let n = 0;
  for (const entry of cache.values()) n += entryBytes(entry);
  return n;
}

/** Evicts least-recently-used entries while the caller's budget remains exceeded. */
function evictWhile(overBudget: () => boolean): void {
  while (cache.size > 1 && overBudget()) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

/** Evicts until both cache bounds hold, or one entry remains. */
function evictOverflow(): void {
  evictWhile(() => cache.size > MAX_ENTRIES || totalBytes() > BUDGET_BYTES);
}

/** The cached piece for `(token, kind, id)`, revalidated by the caller against the live row's write id
 * before use - this function only returns what is held, touching it to the front of the LRU order. */
export function getCachedPiece(token: string, kind: string, id: string): CachedPiece | undefined {
  const key = keyOf(token, kind, id);
  const entry = cache.get(key);
  if (!entry) return undefined;
  cache.delete(key);
  cache.set(key, entry); // LRU touch
  return entry;
}

/** Stores a fresh decompose, deep-frozen, evicting the least recently used entries first if that
 * pushes this store's share - or the whole cache - over its bounds. A closed gate (`setPieceCacheGate`,
 * above) skips the insert entirely - still a no-op, never a throw, so a cold fill racing a lock
 * finishes without leaving anything plaintext behind for it to have cached. */
export function setCachedPiece(token: string, kind: string, id: string, entry: CachedPiece): void {
  if (!cacheGate()) return;
  const key = keyOf(token, kind, id);
  deepFreeze(entry.entity);
  // The WHOLE record, not just `part.value`: `decompose`'s `buildPart` (piece-parts.ts) hands back
  // this EXACT object reference on the next patch when its value is unchanged (`cached.value ===
  // value`), so `hash`, `json`, and `blobs` need the same immutability guarantee `value` already had -
  // a mutated `hash` on a reused record would make the next revision agree with content that was
  // never actually re-hashed.
  for (const part of entry.parts) deepFreeze(part);
  cache.set(key, Object.freeze({ ...entry, parts: Object.freeze([...entry.parts]) }));
  evictOverflow();
  onInsert();
}

/** Drops one store's own cached piece, if any - used when a patch discovers the live row is gone
 * (`missing`), so a stale entry never outlives the piece it described. */
export function dropCachedPiece(token: string, kind: string, id: string): void {
  cache.delete(keyOf(token, kind, id));
}

/** The registry's own three hooks (`src/stage/caches.ts`'s `CacheEntry` shape): total bytes, a trim to
 * at most `toBytes` (LRU-first, same as `evictOverflow`), and a full clear for `lockAll()`. */
export function pieceCacheBytes(): number {
  return totalBytes();
}
export function trimPieceCache(toBytes: number): void {
  // Mirrors core/tokens' own trim: stops at one entry rather than zero, so a budget-pressure trim
  // never fully cold-starts the cache the way a lock's `clearPieceCache` deliberately does.
  evictWhile(() => totalBytes() > toBytes);
}
export function clearPieceCache(): void {
  cache.clear();
}

/** Test-only: lets a test assert on the cache's raw shape without reaching through the registry. */
export function __pieceCacheSizeForTests(): number {
  return cache.size;
}
