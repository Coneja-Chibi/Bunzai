/** Plain + regex keyword matching, ported from RoleCall triggers/keyword.ts. */
import { describe, expect, test } from "bun:test";
import { matchKeywordTrigger } from "./triggers-keyword";

const t = (keyword: string, patch: Partial<Parameters<typeof matchKeywordTrigger>[0]> = {}) => ({
  keyword,
  isRegex: false,
  ...patch,
});
test("regex triggers refuse grammar flags the structural screen does not support", () => {
  expect(matchKeywordTrigger(t("a", { isRegex: true, flags: "v" }), "a", { caseSensitive: true, matchWholeWords: false })).toBe(false);
});

describe("matchKeywordTrigger: plain keywords", () => {
  test("substring match, case-insensitive by default", () => {
    expect(matchKeywordTrigger(t("dragon"), "A Dragon appeared", { caseSensitive: false, matchWholeWords: false })).toBe(true);
  });

  test("case-sensitive rejects a differently-cased match", () => {
    expect(matchKeywordTrigger(t("Dragon"), "a dragon appeared", { caseSensitive: true, matchWholeWords: false })).toBe(false);
  });

  test("whole-word rejects a substring inside a longer word", () => {
    expect(matchKeywordTrigger(t("cat"), "concatenate", { caseSensitive: false, matchWholeWords: true })).toBe(false);
    expect(matchKeywordTrigger(t("cat"), "the cat sat", { caseSensitive: false, matchWholeWords: true })).toBe(true);
  });

  test("whole-word multi-word key matches via the \\W boundary, no includes() fallback needed", () => {
    expect(matchKeywordTrigger(t("New York"), "I live in New York City", { caseSensitive: false, matchWholeWords: true })).toBe(true);
  });
});

describe("matchKeywordTrigger: regex keywords", () => {
  test("regex flags override case-sensitivity when the trigger sets its own", () => {
    expect(matchKeywordTrigger(t("DRAGON", { isRegex: true, flags: "" }), "a dragon appeared", { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });

  test("no flags on the trigger falls back to case-insensitive when the entry isn't case-sensitive", () => {
    expect(matchKeywordTrigger(t("DRAGON", { isRegex: true }), "a dragon appeared", { caseSensitive: false, matchWholeWords: false })).toBe(true);
  });

  test("a ReDoS-dangerous regex key never matches (fails closed)", () => {
    expect(matchKeywordTrigger(t("(a+)+$", { isRegex: true }), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!", { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });

  test("a bounded-outer/unbounded-inner ReDoS key is refused, not compiled (D6's analyzeRedos fix)", () => {
    // (.*a){12} is a catastrophic-backtracking shape with a bounded outer repeat, which the
    // vet used to let through (2026-09-28 stop report). D6 is fixing analyzeRedos in
    // src/core/regex/ to reject it; this key must never match once that lands. If this test
    // fails, it means D6 has not landed in this checkout yet, not a regression here.
    expect(matchKeywordTrigger(t("(.*a){12}", { isRegex: true }), "a".repeat(30), { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });

  test("an invalid regex pattern never matches", () => {
    expect(matchKeywordTrigger(t("(unterminated", { isRegex: true }), "anything", { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });

  // B-F2: RegExp.test on a `g` regex is stateful - it advances
  // `lastIndex` on a match and resumes from there next call - so a cached `g` key used to
  // alternate matched/unmatched on identical repeated input. `g` means nothing extra for a
  // yes/no `.test()`, so the compiler strips it before compiling (and before keying the cache).
  test("a cached `g`-flag regex key gives the same answer on every repeated call (B-F2)", () => {
    const trigger = t("OOC", { isRegex: true, flags: "gi" });
    const results = [1, 2, 3, 4].map(() => matchKeywordTrigger(trigger, "hello (OOC: hi)", { caseSensitive: false, matchWholeWords: false }));
    expect(results).toEqual([true, true, true, true]);
  });

  // `y` (sticky) is NOT stripped, because that would silently change what the key means: a sticky
  // regex only matches starting exactly at its lastIndex, which for a fresh test against a whole
  // string means "at the very start". Stripping it would turn "/dragon/y" into an anywhere-in-text
  // search, matching "a dragon appeared" when the key's author asked for an anchored match.
  test("a `y`-flag key keeps its anchored-at-start meaning, not a stripped-flag substring search", () => {
    const trigger = t("dragon", { isRegex: true, flags: "y" });
    expect(matchKeywordTrigger(trigger, "dragon here", { caseSensitive: false, matchWholeWords: false })).toBe(true);
    expect(matchKeywordTrigger(trigger, "a dragon appeared", { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });

  test("a cached `y`-flag regex key gives the same answer on every repeated call, not [true,false,true,false] (B-F2)", () => {
    const trigger = t("dragon", { isRegex: true, flags: "y" });
    const results = [1, 2, 3, 4].map(() => matchKeywordTrigger(trigger, "dragon here", { caseSensitive: false, matchWholeWords: false }));
    expect(results).toEqual([true, true, true, true]);
  });

  test("a `gy`-flag key drops only `g`; `y` still anchors, and stays stable across repeats", () => {
    const trigger = t("dragon", { isRegex: true, flags: "gyi" });
    const results = [1, 2, 3, 4].map(() => matchKeywordTrigger(trigger, "Dragon here", { caseSensitive: false, matchWholeWords: false }));
    expect(results).toEqual([true, true, true, true]);
    expect(matchKeywordTrigger(trigger, "a dragon appeared", { caseSensitive: false, matchWholeWords: false })).toBe(false);
  });
});
