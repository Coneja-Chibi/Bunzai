/**
 * M3, compiled lore matcher: a multi-pattern matcher over a book's plain (non-regex, non-special) trigger keys, so one
 * pass over an entry's scan text finds every plain key hit, instead of triggers-keyword.ts's
 * matchKeywordTrigger doing its own substring/whole-word check per trigger per entry per turn - the
 * cost that made runLore scale with entry count (measured: tens of ms/turn at 5,000 entries even
 * with the B-F3 regex-cache fix already in).
 *
 * Aho-Corasick (1975): textbook multi-pattern string matching, general practice, not ported from
 * anywhere. Keys are bucketed by the two settings
 * that change what "hit" means - `caseSensitive` and `matchWholeWords` - so at most 4 tries per
 * book, each built once. A whole-word hit is confirmed by checking the Unicode word boundary (key-word-boundary.ts,
 * shared with triggers-keyword.ts) around every occurrence the trie reports, which is exactly what
 * that file's lookaround regex tests for: this file never adds a rule triggers-keyword.ts doesn't
 * already have.
 *
 * Regex and special ([xxx]) triggers are untouched: scan.ts's matchTrigger only consults a bucket
 * for a trigger that is neither, and falls back to today's matchKeywordTrigger/matchSpecialTrigger
 * whenever no compiled index was handed in (recursion.ts, the Workbench preview, every existing
 * test) - so this file changes nothing for a caller that doesn't opt in.
 *
 * Cached by a structurally fingerprinted public input, or by the privately bound stored revision
 * when the exact deeply frozen store-owned body is available. The common derive owner supplies the
 * bounded memory tier; this family stays memory-only because compilation is cheap enough to rebuild.
 * A cached trie holds decrypted keys, so the same keyring lock clears this family with token results.
 */
import { defineDerivePolicy, derive, derivedFamilyBytes, derivedFamilySize, setDeriveGate, setDeriveInsertHook, trimDerivedFamily, clearDerivedFamily } from "../../derive/derive";
import { isSpecialTrigger } from "./triggers-special";
import { resolveKeywordOptions } from "./triggers-keyword";
import { hashHex } from "../../sha256";
import type { LoreBookInput } from "./types";
import type { Trigger } from "../../../entities/lorebook/schema";
import { getStoredLoreRevision } from "./stored-input";
import { codePointBefore, isWordCodePoint } from "./key-word-boundary";


/**
 * One Aho-Corasick trie: add() every key once (case already folded by the caller for a
 * case-insensitive bucket), build() the failure links once, then scan(text) any number of times -
 * a single pass finds every key's hit, whole-word or not, because each key id carries its OWN
 * whole-word flag: a bucket only splits on case (two tries per book, not four), since a
 * case-insensitive-substring key and a case-insensitive-whole-word key read the exact same
 * lowercased text and only differ in the boundary check done at a hit (measured: this halves the
 * text-length work scan() does per turn versus one trie per (case, whole-word) pair). Operates on
 * UTF-16 code units (`charCodeAt`), the same granularity `String.includes` and a non-`u` RegExp
 * use, so a surrogate-pair emoji is matched (and bounded) exactly as it is today.
 */
class KeyTrie {
  private goto: Map<number, number>[] = [new Map()];
  private fail: number[] = [0];
  private out: number[][] = [[]];
  private lens: number[] = [];
  private wholeWord: boolean[] = [];
  private ids = new Map<string, number>();

  /** `key` may be added twice under different `wholeWord` flags (the same literal text used both
   * ways by different entries): each combination gets its own id, sharing the trie walk. */
  add(key: string, wholeWord: boolean): number {
    const dedupeKey = `${key}\u0000${wholeWord ? 1 : 0}`;
    let id = this.ids.get(dedupeKey);
    if (id !== undefined) return id;
    id = this.lens.length;
    this.lens.push(key.length);
    this.wholeWord.push(wholeWord);
    this.ids.set(dedupeKey, id);
    let s = 0;
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      let n = this.goto[s]!.get(c);
      if (n === undefined) {
        n = this.goto.length;
        this.goto.push(new Map());
        this.fail.push(0);
        this.out.push([]);
        this.goto[s]!.set(c, n);
      }
      s = n;
    }
    this.out[s]!.push(id);
    return id;
  }

  build(): void {
    const queue: number[] = [];
    for (const [, n] of this.goto[0]!) {
      this.fail[n] = 0;
      queue.push(n);
    }
    for (let h = 0; h < queue.length; h++) {
      const s = queue[h]!;
      for (const [c, n] of this.goto[s]!) {
        queue.push(n);
        let f = this.fail[s]!;
        while (f !== 0 && !this.goto[f]!.has(c)) f = this.fail[f]!;
        const g = this.goto[f]!.get(c);
        this.fail[n] = g !== undefined && g !== n ? g : 0;
        const fo = this.out[this.fail[n]!]!;
        if (fo.length > 0) this.out[n] = this.out[n]!.concat(fo);
      }
    }
  }

  idFor(key: string, wholeWord: boolean): number | undefined {
    return this.ids.get(`${key}\u0000${wholeWord ? 1 : 0}`);
  }

  get keyCount(): number {
    return this.lens.length;
  }

  /** One pass over `text`: a non-whole-word id hits on any occurrence (today's plain substring
   * check, `text.includes`, has no boundary condition); a whole-word id additionally needs the
   * char before the occurrence (or the start of text) and the char after it (or the end of text)
   * to both be non-word - the exact truth condition the lookaround regex's `.test()` looks for,
   * checked independently rather than via a shared, consumed boundary character: for a plain "does
   * it match anywhere" question the two are equivalent (either alternative just needs one
   * satisfying position, and this checks the same position the regex would). */
  scan(text: string, hits: Uint8Array): void {
    let s = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      let n = this.goto[s]!.get(c);
      while (n === undefined && s !== 0) {
        s = this.fail[s]!;
        n = this.goto[s]!.get(c);
      }
      s = n ?? 0;
      const o = this.out[s]!;
      for (let k = 0; k < o.length; k++) {
        const id = o[k]!;
        if (hits[id] === 1) continue;
        if (!this.wholeWord[id]) {
          hits[id] = 1;
          continue;
        }
        const end = i + 1;
        const start = end - this.lens[id]!;
        const beforeOk = start === 0 || !isWordCodePoint(codePointBefore(text, start));
        const afterOk = end === text.length || !isWordCodePoint(text.codePointAt(end)!);
        if (beforeOk && afterOk) hits[id] = 1;
      }
    }
  }
}

interface KeyBucket {
  caseSensitive: boolean;
  trie: KeyTrie;
}

/** One book's compiled matcher: at most 2 tries (case sensitive / insensitive), built once per
 * revision - see the KeyTrie docblock for why whole-word does not split this further. */
export interface CompiledBookIndex {
  bookId: string;
  buckets: Map<string, KeyBucket>;
}

/** Per-scan-text hit lookup, built by scanning a compiled book index against one entry's scan
 * text. scan.ts's matchTrigger consults this instead of matchKeywordTrigger for a plain key. */
export interface KeyHits {
  has(keyword: string, caseSensitive: boolean, wholeWord: boolean): boolean;
}

const EMPTY_HITS: KeyHits = { has: () => false };

function addTrigger(buckets: Map<string, KeyBucket>, t: Trigger, caseSensitive: boolean, wholeWord: boolean): void {
  if (t.isRegex || !t.keyword || isSpecialTrigger(t.keyword)) return;
  const bk = caseSensitive ? "1" : "0";
  let bucket = buckets.get(bk);
  if (!bucket) {
    bucket = { caseSensitive, trie: new KeyTrie() };
    buckets.set(bk, bucket);
  }
  bucket.trie.add(caseSensitive ? t.keyword : t.keyword.toLowerCase(), wholeWord);
}

/** Compiles one book's plain keys into at most 2 tries. Pure: no cache, no clock, no random - the
 * cache wrapper below is the only stateful part of this file. */
export function compileBookKeyIndex(book: LoreBookInput): CompiledBookIndex {
  const buckets = new Map<string, KeyBucket>();
  for (const entry of book.body.entries) {
    const { caseSensitive, matchWholeWords } = resolveKeywordOptions(entry, book.body);
    for (const t of entry.triggers) addTrigger(buckets, t, caseSensitive, matchWholeWords);
    for (const t of entry.secondaryTriggers) addTrigger(buckets, t, caseSensitive, matchWholeWords);
  }
  for (const bucket of buckets.values()) bucket.trie.build();
  return { bookId: book.id, buckets };
}

/** Scans one book's compiled index against one entry's scan text, once per case bucket the book
 * actually uses (at most 2). Lowercases the text at most once (only when a case-insensitive
 * bucket actually exists). */
export function scanBookKeyIndex(index: CompiledBookIndex, text: string): KeyHits {
  if (index.buckets.size === 0) return EMPTY_HITS;
  const hitsByBucket = new Map<string, Uint8Array>();
  let lower: string | undefined;
  for (const [bk, bucket] of index.buckets) {
    const hits = new Uint8Array(bucket.trie.keyCount);
    const scanText = bucket.caseSensitive ? text : (lower ??= text.toLowerCase());
    bucket.trie.scan(scanText, hits);
    hitsByBucket.set(bk, hits);
  }
  return {
    has(keyword, caseSensitive, wholeWord) {
      const bk = caseSensitive ? "1" : "0";
      const bucket = index.buckets.get(bk);
      if (!bucket) return false;
      const key = caseSensitive ? keyword : keyword.toLowerCase();
      const id = bucket.trie.idFor(key, wholeWord);
      return id !== undefined && hitsByBucket.get(bk)![id] === 1;
    },
  };
}

// ---------------------------------------------------------------------------
// Revision + cache (mirrors triggers-keyword.ts's LRU keyword-regex caches exactly)
// ---------------------------------------------------------------------------

function triggerFingerprint(t: Trigger): readonly [string, string] {
  if (t.isRegex) return ["regex", ""];
  return isSpecialTrigger(t.keyword) ? ["special", ""] : ["plain", t.keyword];
}

/** Public authored inputs are fingerprinted structurally each time. Only the internal stored-input
 * factory can provide the bound revision without revisiting every compile input. */
function bookRevision(book: LoreBookInput): string {
  const stored = getStoredLoreRevision(book);
  if (stored) return `${book.id}\0${stored}`;
  const parts = [book.id, book.body.entries.map((entry) => {
    const { caseSensitive, matchWholeWords } = resolveKeywordOptions(entry, book.body);
    return [entry.id, caseSensitive, matchWholeWords, entry.triggers.map(triggerFingerprint), entry.secondaryTriggers.map(triggerFingerprint)];
  })];
  return hashHex(JSON.stringify(parts));
}

/** AN ESTIMATE, documented: one trie key's node chain, failure link, and output-list entries at
 * typical branching (`KEY_TRIE_BYTES_PER_KEY`), plus the CompiledBookIndex object and its bucket
 * Maps regardless of key count (`COMPILED_INDEX_OVERHEAD_BYTES`). Neither figure is measured - a
 * trie's real footprint depends on how much its keys share prefixes, which this does not know. */
const KEY_TRIE_BYTES_PER_KEY = 96;
const COMPILED_INDEX_OVERHEAD_BYTES = 256;
function estimateIndexBytes(index: CompiledBookIndex): number {
  let keys = 0;
  for (const bucket of index.buckets.values()) keys += bucket.trie.keyCount;
  return keys * KEY_TRIE_BYTES_PER_KEY + COMPILED_INDEX_OVERHEAD_BYTES;
}

const FAMILY = "lore.key-index";
const VERSION = "aho-trie-v2";
const policy = defineDerivePolicy<CompiledBookIndex>(FAMILY, {
  version: VERSION, persist: "never",
  memoryBytes: (_revision, index) => estimateIndexBytes(index),
});

/** Test-only: compiles actually run vs. cache hits since the last reset. Never read by production code. */
let compiles = 0;

/** Same open-by-default gate contract as triggers-keyword.ts's cacheGate - closed only while
 * src/stage/crypto/keyring.ts's keyring holds no key. */
export function setLoreKeyIndexCacheGate(gate: () => boolean): void {
  setDeriveGate(gate, FAMILY);
}

/** Called once after a real cache write (never a hit) finishes inserting and evicting, so the cache
 * registry (src/stage/caches.ts, src/ui/_shared/caches.ts) can sample memory pressure right after
 * this module's own state actually changed. Open (a no-op) by default, mirroring
 * triggers-keyword.ts's setKeywordRegexCacheInsertHook. */
export function setLoreKeyIndexCacheInsertHook(hook: () => void): void {
  setDeriveInsertHook(hook, FAMILY);
}

/** This module's whole cache, in bytes - the one figure the cache registry's budget and trim compare
 * against (see estimateIndexBytes above for what it estimates). */
export function loreKeyIndexCacheBytes(): number {
  return derivedFamilyBytes(`${FAMILY}@${VERSION}`);
}

/** Evicts the oldest entries until loreKeyIndexCacheBytes() is at or under targetBytes. A no-op when
 * already at or under target. Registered as this module's `trim` with the cache registry. */
export function trimLoreKeyIndexCache(targetBytes: number): void {
  trimDerivedFamily(`${FAMILY}@${VERSION}`, targetBytes);
}

/** Compiled once per (book id, revision), reused across every turn until the book's plain keys,
 * their case/whole-word settings, or which triggers are regex/special actually change. */
export function compileBookKeyIndexCached(book: LoreBookInput): CompiledBookIndex {
  const revision = bookRevision(book);
  return derive(FAMILY, revision, () => { compiles++; return compileBookKeyIndex(book); }, policy);
}

/** Clears this family's memory entries. The common derived owner handles lock lifecycle and storage. */
export function clearLoreKeyIndexCache(): void {
  clearDerivedFamily(`${FAMILY}@${VERSION}`);
}

/** Test-only introspection. Never read by production code. */
export function __loreKeyIndexCacheStatsForTests(): { compiles: number; size: number } {
  return { compiles, size: derivedFamilySize(`${FAMILY}@${VERSION}`) };
}

/** Test-only: empties the cache, zeroes the compile counter, and reopens the gate. Never called by
 * production code. */
export function __resetLoreKeyIndexCacheForTests(): void {
  clearLoreKeyIndexCache();
  compiles = 0;
  setLoreKeyIndexCacheGate(() => true);
}
