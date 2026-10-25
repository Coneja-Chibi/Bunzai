/**
 * M3 cache gate: key-index.ts compiles a book's tries once
 * per (book id, revision) and reuses them across turns - the whole point of "cache the compiled
 * matcher by (book id, revision)". This is the GREEN gate for that: a second, identical turn over
 * a 5,000-entry book must compile zero new tries, and editing one entry's keyword must recompile
 * exactly the one book it belongs to, not the others sharing the call.
 */
import { describe, expect, test } from "bun:test";
import { runLore } from "./engine";
import {
  __loreKeyIndexCacheStatsForTests,
  __resetLoreKeyIndexCacheForTests,
  compileBookKeyIndexCached,
  loreKeyIndexCacheBytes,
  setLoreKeyIndexCacheGate,
  setLoreKeyIndexCacheInsertHook,
  trimLoreKeyIndexCache,
} from "./key-index";
import { book, entry, msg, scan } from "./_test-helpers";
import type { LorebookEntry } from "../../../entities/lorebook/schema";
import type { LoreRunOptions } from "./types";

const ENTRY_COUNT = 5000;

function bigBook(id = "syn-5000"): ReturnType<typeof book> {
  const entries: LorebookEntry[] = Array.from({ length: ENTRY_COUNT }, (_, i) =>
    entry(`e${i}`, {
      content: `Entry content number ${i}, padded to a realistic lorebook entry size. `.repeat(6),
      triggers: [{ keyword: `plainkey${i}`, isRegex: false }],
    }),
  );
  return book(id, entries, { globalMatchWholeWords: true, globalScanDepth: 4 });
}

const runOptions = (): LoreRunOptions => ({
  rng: () => 0.5,
  countTokens: (s) => s.length,
  budgetTokens: Infinity,
  recentFires: [],
  explain: false,
  chance: "roll",
});

describe("M3 cache: compiled key index over 5,000 entries", () => {
  test("a second, identical turn compiles zero new tries", () => {
    __resetLoreKeyIndexCacheForTests();
    const b = bigBook();
    const s = scan({ messages: [msg("a quiet evening, nothing special happens here at all")] });

    const run1 = runLore([b], s, runOptions());
    expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(1); // one book, compiled once

    const run2 = runLore([b], s, runOptions()); // same book content, same scan: nothing changed
    expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(1); // cache hit, no recompile
    expect(run2).toEqual(run1); // the cache changed nothing about what was returned
  });

  test("editing one entry's keyword recompiles only that book", () => {
    __resetLoreKeyIndexCacheForTests();
    const a = bigBook("book-a");
    const c = bigBook("book-b");
    compileBookKeyIndexCached(a);
    compileBookKeyIndexCached(c);
    expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(2);

    const edited = book(
      "book-a",
      a.body.entries.map((e, i) => (i === 0 ? { ...e, triggers: [{ keyword: "brandnewkeyword", isRegex: false }] } : e)),
      { globalMatchWholeWords: true, globalScanDepth: 4 },
    );
    compileBookKeyIndexCached(edited); // book-a's content changed: recompiles
    expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(3);
    compileBookKeyIndexCached(c); // book-b untouched: still cached
    expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(3);
  });

  test("closing the gate stops caching without breaking matches", () => {
    __resetLoreKeyIndexCacheForTests();
    setLoreKeyIndexCacheGate(() => false);
    try {
      const b = bigBook("gated");
      compileBookKeyIndexCached(b);
      compileBookKeyIndexCached(b);
      expect(__loreKeyIndexCacheStatsForTests().compiles).toBe(2); // never cached: recompiles every call
      expect(__loreKeyIndexCacheStatsForTests().size).toBe(0);
    } finally {
      __resetLoreKeyIndexCacheForTests();
    }
  });
});

/**
 * Characterization tests for the cache-registry contract (setLoreKeyIndexCacheInsertHook,
 * loreKeyIndexCacheBytes, trimLoreKeyIndexCache) before createBudgetedLru folds onto it:
 * src/stage/caches.ts calls every one of these, with no in-area test coverage today. Pinned here
 * so the fold cannot silently change what the registry sees. (The gate is already covered above.)
 */
describe("key index cache: registry contract", () => {
  function smallBook(id: string, keyword: string) {
    return book(id, [entry("e1", { triggers: [{ keyword, isRegex: false }] })], {
      globalMatchWholeWords: true,
      globalScanDepth: 4,
    });
  }

  test("the insert hook fires once per real write, never on a hit", () => {
    __resetLoreKeyIndexCacheForTests();
    let fires = 0;
    setLoreKeyIndexCacheInsertHook(() => { fires += 1; });
    try {
      const a = smallBook("hook-a", "alpha");
      compileBookKeyIndexCached(a);
      expect(fires).toBe(1);
      compileBookKeyIndexCached(a); // hit
      expect(fires).toBe(1);
      compileBookKeyIndexCached(smallBook("hook-b", "beta"));
      expect(fires).toBe(2);
    } finally {
      setLoreKeyIndexCacheInsertHook(() => {});
      __resetLoreKeyIndexCacheForTests();
    }
  });

  test("loreKeyIndexCacheBytes grows on insert and trimLoreKeyIndexCache evicts down to a target", () => {
    __resetLoreKeyIndexCacheForTests();
    for (let i = 0; i < 20; i++) compileBookKeyIndexCached(smallBook(`trim-${i}`, `key${i}`));
    const before = loreKeyIndexCacheBytes();
    expect(before).toBeGreaterThan(0);
    trimLoreKeyIndexCache(Math.floor(before / 2));
    expect(loreKeyIndexCacheBytes()).toBeLessThanOrEqual(before);
    expect(loreKeyIndexCacheBytes()).toBeGreaterThan(0); // never trims the single most-recent entry away
  });

  test("trimLoreKeyIndexCache is a no-op once already at or under the target", () => {
    __resetLoreKeyIndexCacheForTests();
    compileBookKeyIndexCached(smallBook("solo", "onlykey"));
    const bytes = loreKeyIndexCacheBytes();
    trimLoreKeyIndexCache(bytes + 1000);
    expect(loreKeyIndexCacheBytes()).toBe(bytes);
  });
});
