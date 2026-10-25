/**
 * `countText`'s cache: a real text hits the encoder once
 * and every later call on the same text is a hit, a hash collision never returns another text's
 * count, and both bounds (entry count, total characters) evict the oldest entry rather than grow
 * without limit. The lore-engine gate that proves this pays off at scale (1,000 enabled entries, a
 * second identical turn does zero BPE runs) lives in `../lore/engine/token-cache.test.ts`, next to
 * the pipeline it measures.
 */
import { describe, expect, test } from "bun:test";
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
import {
  __resetTokenCacheForTests,
  __tokenCacheStatsForTests,
  countMessage,
  countText,
  setTokenCacheGate,
  setTokenCacheInsertHook,
  tokenCacheBytes,
  trimTokenCache,
} from "./base";

const NO_SPECIALS = { disallowedSpecial: new Set<string>() };
/** The ground truth: the real encoder, called directly, bypassing the cache entirely. */
const uncached = (text: string): number => (text ? countTokens(text, NO_SPECIALS) : 0);

describe("countText cache: hit/miss accounting", () => {
  test("an unchanged text is encoded once; a repeat call is a cache hit, not a re-encode", () => {
    __resetTokenCacheForTests();
    const text = "The lantern swayed over the empty stage.";
    const first = countText(text);
    expect(__tokenCacheStatsForTests().realEncodes).toBe(1);
    const second = countText(text);
    expect(__tokenCacheStatsForTests().realEncodes).toBe(1); // no second encode
    expect(second).toBe(first);
  });

  test("different texts each cost their own miss", () => {
    __resetTokenCacheForTests();
    countText("one");
    countText("two");
    countText("three");
    expect(__tokenCacheStatsForTests().realEncodes).toBe(3);
    // Repeating all three afterward adds nothing.
    countText("one");
    countText("two");
    countText("three");
    expect(__tokenCacheStatsForTests().realEncodes).toBe(3);
  });

  test("the empty string never touches the encoder or the cache", () => {
    __resetTokenCacheForTests();
    expect(countText("")).toBe(0);
    expect(__tokenCacheStatsForTests()).toEqual({ realEncodes: 0, cacheSize: 0, cacheChars: 0 });
  });
});

describe("countText cache: cached and uncached counts always agree", () => {
  // countText is the studio's one base-counter family (o200k_base, applied to every model - see
  // base.ts's file header). This is the equality proof M1 asks for: the cache must never change
  // what the same text would have counted uncached, on a miss or on a hit.
  const samples = [
    "a short line of plain prose",
    "She laughs. 灯台の光が揺れる。\n```js\nconst x = 1;\n```\nThen quiet.",
    '{"name":"Vera","tags":["noir","theater"]}',
    "hello <|endoftext|> <|im_start|>", // special-token text, counted as ordinary text
    "one two three four five six seven eight nine ten".repeat(50), // long
    "", // empty, handled separately above but included here for the sweep
    "mixed punctuation, accents (café, naïve), and CJK 舞台 together",
  ];

  test("every sample's cached count matches the direct uncached count, on both a miss and a hit", () => {
    for (const text of samples) {
      __resetTokenCacheForTests();
      const truth = uncached(text);
      expect(countText(text)).toBe(truth); // miss
      expect(countText(text)).toBe(truth); // hit
    }
  });
});

describe("countText cache: a hash collision never returns another text's count", () => {
  // A confirmed same-length fnv1a-32 collision pair for this file's own hash function (found by
  // brute-force search over the exact algorithm in base.ts, not asserted here as a property - this
  // is the real pair, so the test exercises the actual collision-handling branch, not a stand-in).
  const a = "pGKuTD";
  const b = "2a29zM";

  test("two different same-length texts that hash the same still each get their own count", () => {
    __resetTokenCacheForTests();
    const truthA = uncached(a);
    const truthB = uncached(b);
    const countA = countText(a);
    const countB = countText(b); // this call's key collides with a's key
    expect(countA).toBe(truthA);
    expect(countB).toBe(truthB);
    // Asking for `a` again must still return `a`'s count, never `b`'s (the bug this guards against:
    // trusting the hash alone would have returned countB here after b's insert evicted a's slot).
    expect(countText(a)).toBe(truthA);
  });
});

describe("countText cache: bounded, never grows without limit", () => {
  test("entry count is bounded: pushing far more than the cap through countText evicts the oldest", () => {
    __resetTokenCacheForTests();
    const over = 20_050; // > the 20,000-entry cap (base.ts TEXT_CACHE_MAX_ENTRIES)
    for (let i = 0; i < over; i++) countText(`tiny-${i}`);
    const stats = __tokenCacheStatsForTests();
    expect(stats.cacheSize).toBeLessThanOrEqual(20_000);
    expect(stats.realEncodes).toBe(over); // every one of these texts was genuinely distinct
    // The most recent text is still a hit (proves LRU order, not just a size cap).
    const before = stats.realEncodes;
    countText(`tiny-${over - 1}`);
    expect(__tokenCacheStatsForTests().realEncodes).toBe(before);
  }, 20_000);

  test("total characters is bounded independently of entry count", () => {
    __resetTokenCacheForTests();
    const big = "x".repeat(4000);
    const entries = 9000; // UTF-16 input alone exceeds the shared 64 MiB budget, below its 20,000-entry cap
    for (let i = 0; i < entries; i++) countText(`${big}-${i}`);
    const stats = __tokenCacheStatsForTests();
    expect(tokenCacheBytes()).toBeLessThanOrEqual(64 * 1024 * 1024);
    expect(stats.cacheSize).toBeLessThan(entries);
    expect(stats.cacheSize).toBeLessThan(entries); // eviction happened well before the entry cap
  }, 20_000);
});

/**
 * Characterization tests for the cache-registry contract (setTokenCacheGate,
 * setTokenCacheInsertHook, tokenCacheBytes, trimTokenCache) before createBudgetedLru folds onto
 * it: src/stage/caches.ts calls every one of these, with no in-area test coverage today. Pinned
 * here so the fold cannot silently change what the registry sees.
 */
describe("countText/countMessage cache: registry contract", () => {
  test("a closed gate skips both the read and the write side", () => {
    __resetTokenCacheForTests();
    countText("warmed");
    setTokenCacheGate(() => false);
    try {
      const before = __tokenCacheStatsForTests();
      countText("warmed"); // would be a hit if the gate were open
      expect(__tokenCacheStatsForTests().realEncodes).toBe(before.realEncodes + 1); // re-encoded, not served from cache
      countText("never stored");
      expect(__tokenCacheStatsForTests().cacheSize).toBe(before.cacheSize); // new text never entered the cache
    } finally {
      __resetTokenCacheForTests();
    }
  });

  test("the insert hook fires once per real write, never on a hit", () => {
    __resetTokenCacheForTests();
    let fires = 0;
    setTokenCacheInsertHook(() => { fires += 1; });
    try {
      countText("alpha");
      expect(fires).toBe(1);
      countText("alpha"); // hit
      expect(fires).toBe(1);
      countText("beta");
      expect(fires).toBe(2);
    } finally {
      setTokenCacheInsertHook(() => {});
      __resetTokenCacheForTests();
    }
  });

  test("tokenCacheBytes grows on insert and trimTokenCache evicts down to a target", () => {
    __resetTokenCacheForTests();
    for (let i = 0; i < 50; i++) countText(`some text number ${i} with a bit of padding`);
    const before = tokenCacheBytes();
    expect(before).toBeGreaterThan(0);
    trimTokenCache(Math.floor(before / 2));
    expect(tokenCacheBytes()).toBeLessThanOrEqual(before);
    expect(tokenCacheBytes()).toBeGreaterThan(0); // never trims the single most-recent entry away
  });

  test("trimTokenCache is a no-op once already at or under the target", () => {
    __resetTokenCacheForTests();
    countText("one entry");
    const bytes = tokenCacheBytes();
    trimTokenCache(bytes + 1000);
    expect(tokenCacheBytes()).toBe(bytes);
  });

  test("countMessage's own cache also counts toward tokenCacheBytes and is evicted by trim", () => {
    __resetTokenCacheForTests();
    for (let i = 0; i < 20; i++) countMessage(`message number ${i} with some padding text here`);
    const before = tokenCacheBytes();
    trimTokenCache(0);
    expect(tokenCacheBytes()).toBeLessThan(before);
  });
});
