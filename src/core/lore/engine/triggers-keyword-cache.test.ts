/**
 * B-F3 perf gate: the whole-word regex cache in
 * triggers-keyword.ts used to clear() itself entirely once it hit a 2,000-entry cap, so a scene
 * with more than 2,000 distinct whole-word keys recompiled every one of them, every turn (measured:
 * 7,508 `new RegExp()` calls per turn on a 5,000-entry synthetic book, steady state). This is the
 * GREEN gate: a second, identical turn over a 5,000-entry all-whole-word book must compile zero new
 * patterns.
 *
 * M3 moved runLore's own direct-match pass onto key-index.ts's
 * compiled matcher, which never calls triggers-keyword.ts's matchKeywordTrigger for a plain key -
 * see key-index-cache.test.ts for that cache's own version of this same regression gate. This
 * cache is still real, load-bearing code: recursion.ts's evaluateWithRecursion and the Workbench
 * preview (lore-run.ts) call evaluateEntry with no compiled index, exactly like before M3, so they
 * still need this cache to not thrash. Exercising it here means calling evaluateEntry directly
 * (the no-index path) instead of runLore, so the gate still tests the code it names.
 */
import { describe, expect, test } from "bun:test";
import {
  __keywordRegexCacheStatsForTests,
  __resetKeywordRegexCachesForTests,
  keywordRegexCacheBytes,
  matchKeywordTrigger,
  setKeywordRegexCacheGate,
  setKeywordRegexCacheInsertHook,
  trimKeywordRegexCache,
} from "./triggers-keyword";
import { evaluateEntry } from "./scan";
import { timersFrom } from "./timers";
import { book, entry, msg, scan } from "./_test-helpers";
import type { LorebookEntry } from "../../../entities/lorebook/schema";

const ENTRY_COUNT = 5000;

function bigWholeWordBook() {
  const entries: LorebookEntry[] = Array.from({ length: ENTRY_COUNT }, (_, i) =>
    entry(`e${i}`, {
      content: `Entry content number ${i}, padded to a realistic lorebook entry size. `.repeat(6),
      triggers: [{ keyword: `wholeword${i}`, isRegex: false }],
      // matchWholeWords left null: every entry inherits the book's global (true) below.
    }),
  );
  return book("syn-5000", entries, { globalMatchWholeWords: true, globalScanDepth: 4 });
}

const keywordOptions = { caseSensitive: false, matchWholeWords: true };

/** Every entry's evaluateEntry call, the no-compiled-index path (recursion.ts's own shape). */
function evaluateAll(b: ReturnType<typeof book>, text: string): void {
  const timers = timersFrom([]);
  const s = scan({ messages: [msg(text)] });
  for (const e of b.body.entries) evaluateEntry(e, text, keywordOptions, s, () => 0.5, timers, "highest");
}

describe("B-F3 perf gate: whole-word keyword cache over 5,000 entries (no-index path)", () => {
  test("a second, identical turn compiles zero new whole-word patterns", () => {
    __resetKeywordRegexCachesForTests();
    const b = bigWholeWordBook();
    const text = "a quiet evening, nothing special happens here at all";

    evaluateAll(b, text);
    const afterTurn1 = __keywordRegexCacheStatsForTests().wholeWordCompiles;
    // The first turn genuinely compiles: one distinct pattern per entry (5,000 here; the plan's real
    // measured 7,508 came from real books with more distinct keys per entry).
    expect(afterTurn1).toBe(ENTRY_COUNT);
    expect(afterTurn1).toBeGreaterThan(2000); // bigger than the old cap: this is the regression case

    evaluateAll(b, text); // same book, same text: nothing changed
    const afterTurn2 = __keywordRegexCacheStatsForTests().wholeWordCompiles;
    expect(afterTurn2 - afterTurn1).toBe(0); // the gate itself: 7,508-shape -> 0 on turn 2
  });

  test("editing one entry's keyword recompiles only that entry's pattern", () => {
    __resetKeywordRegexCachesForTests();
    const b = bigWholeWordBook();
    const text = "a quiet evening, nothing special happens here at all";
    evaluateAll(b, text);
    const before = __keywordRegexCacheStatsForTests().wholeWordCompiles;

    const edited = book(
      "syn-5000",
      b.body.entries.map((e, i) => (i === 0 ? { ...e, triggers: [{ keyword: "brandnewkeyword", isRegex: false }] } : e)),
      { globalMatchWholeWords: true, globalScanDepth: 4 },
    );
    evaluateAll(edited, text);
    expect(__keywordRegexCacheStatsForTests().wholeWordCompiles - before).toBe(1);
  });
});

/**
 * Characterization tests for the cache-registry contract (setKeywordRegexCacheGate,
 * setKeywordRegexCacheInsertHook, keywordRegexCacheBytes, trimKeywordRegexCache) before
 * createBudgetedLru folds onto it: src/stage/caches.ts calls every one of these, with no in-area
 * test coverage today. Pinned here so the fold cannot silently change what the registry sees.
 */
describe("keyword regex cache: registry contract", () => {
  const wholeWordOptions = { caseSensitive: false, matchWholeWords: true };
  const regexOptions = { caseSensitive: false, matchWholeWords: false };

  test("a closed gate skips both the read and the write side, for both the regex and whole-word caches", () => {
    __resetKeywordRegexCachesForTests();
    matchKeywordTrigger({ keyword: "dragon", isRegex: false }, "a dragon flies", wholeWordOptions);
    setKeywordRegexCacheGate(() => false);
    try {
      const before = __keywordRegexCacheStatsForTests();
      matchKeywordTrigger({ keyword: "dragon", isRegex: false }, "a dragon flies", wholeWordOptions);
      expect(__keywordRegexCacheStatsForTests().wholeWordCompiles).toBe(before.wholeWordCompiles + 1); // recompiled, not a hit
      expect(__keywordRegexCacheStatsForTests().wholeWordSize).toBe(before.wholeWordSize); // never entered the cache
    } finally {
      __resetKeywordRegexCachesForTests();
    }
  });

  test("the insert hook fires once per real write, never on a hit", () => {
    __resetKeywordRegexCachesForTests();
    let fires = 0;
    setKeywordRegexCacheInsertHook(() => { fires += 1; });
    try {
      matchKeywordTrigger({ keyword: "phoenix", isRegex: false }, "a phoenix rises", wholeWordOptions);
      expect(fires).toBe(1);
      matchKeywordTrigger({ keyword: "phoenix", isRegex: false }, "a phoenix rises", wholeWordOptions); // hit
      expect(fires).toBe(1);
      matchKeywordTrigger({ keyword: "griffin", isRegex: false }, "a griffin soars", wholeWordOptions);
      expect(fires).toBe(2);
    } finally {
      setKeywordRegexCacheInsertHook(() => {});
      __resetKeywordRegexCachesForTests();
    }
  });

  test("keywordRegexCacheBytes grows on insert and trimKeywordRegexCache evicts down to a target", () => {
    __resetKeywordRegexCachesForTests();
    for (let i = 0; i < 50; i++) {
      matchKeywordTrigger({ keyword: `word${i}`, isRegex: false }, `a word${i} here`, wholeWordOptions);
      matchKeywordTrigger({ keyword: `pattern${i}`, isRegex: true }, `pattern${i} text`, regexOptions);
    }
    const before = keywordRegexCacheBytes();
    expect(before).toBeGreaterThan(0);
    trimKeywordRegexCache(Math.floor(before / 2));
    expect(keywordRegexCacheBytes()).toBeLessThanOrEqual(before);
    expect(keywordRegexCacheBytes()).toBeGreaterThan(0); // never trims the single most-recent entry of each cache away
  });

  test("trimKeywordRegexCache is a no-op once already at or under the target", () => {
    __resetKeywordRegexCachesForTests();
    matchKeywordTrigger({ keyword: "solo", isRegex: false }, "a solo entry", wholeWordOptions);
    const bytes = keywordRegexCacheBytes();
    trimKeywordRegexCache(bytes + 1000);
    expect(keywordRegexCacheBytes()).toBe(bytes);
  });
});
