/**
 * key-index.ts unit tests: bucketing by (caseSensitive, matchWholeWords), whole-word boundary
 * exactness on ASCII/CJK/emoji text, and the case-insensitive substring path. The differential
 * test (key-index-differential.test.ts) covers exactness against today's matcher at scale; these
 * are the small, hand-checkable edge cases worth naming.
 */
import { describe, expect, test } from "bun:test";
import { compileBookKeyIndex, scanBookKeyIndex } from "./key-index";
import { book, entry } from "./_test-helpers";
import type { LorebookEntry } from "../../../entities/lorebook/schema";

function oneEntryBook(triggers: { keyword: string; isRegex?: boolean }[], patch: Partial<LorebookEntry> = {}) {
  return book("b", [entry("e1", { triggers: triggers.map((t) => ({ isRegex: false, ...t })), ...patch })]);
}

describe("key-index: whole-word boundary", () => {
  test("matches a whole word surrounded by spaces", () => {
    const b = oneEntryBook([{ keyword: "cat" }], { matchWholeWords: true, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "a black cat sat").has("cat", false, true)).toBe(true);
  });

  test("does not match a substring inside a longer word", () => {
    const b = oneEntryBook([{ keyword: "cat" }], { matchWholeWords: true, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "a category error").has("cat", false, true)).toBe(false);
  });

  test("a CJK/emoji neighbor counts as a boundary (non-word), matching triggers-keyword.ts's plain \\W", () => {
    const b = oneEntryBook([{ keyword: "cat" }], { matchWholeWords: true, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "龍cat城").has("cat", false, true)).toBe(true);
    expect(scanBookKeyIndex(idx, "\u{1F409}cat\u{1F409}").has("cat", false, true)).toBe(true);
  });

  test("an ASCII letter glued to the key is not a boundary", () => {
    const b = oneEntryBook([{ keyword: "cat" }], { matchWholeWords: true, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "xcatx").has("cat", false, true)).toBe(false);
    expect(scanBookKeyIndex(idx, "xcat").has("cat", false, true)).toBe(false);
    expect(scanBookKeyIndex(idx, "catx").has("cat", false, true)).toBe(false);
  });
});

describe("key-index: case sensitivity", () => {
  test("case-insensitive substring matches regardless of case", () => {
    const b = oneEntryBook([{ keyword: "Dragon" }], { matchWholeWords: false, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "a DRAGON flew by").has("Dragon", false, false)).toBe(true);
  });

  test("case-sensitive substring requires exact case", () => {
    const b = oneEntryBook([{ keyword: "Dragon" }], { matchWholeWords: false, caseSensitive: true });
    const idx = compileBookKeyIndex(b);
    expect(scanBookKeyIndex(idx, "a dragon flew by").has("Dragon", true, false)).toBe(false);
    expect(scanBookKeyIndex(idx, "a Dragon flew by").has("Dragon", true, false)).toBe(true);
  });
});

describe("key-index: bucketing and exclusions", () => {
  test("a regex trigger never enters a trie", () => {
    const b = oneEntryBook([{ keyword: "dr.gon", isRegex: true }], { matchWholeWords: false, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(idx.buckets.size).toBe(0);
    expect(scanBookKeyIndex(idx, "a dragon flew by").has("dr.gon", false, false)).toBe(false);
  });

  test("a special [type:value] trigger never enters a trie", () => {
    const b = oneEntryBook([{ keyword: "[messageCount:>5]" }], { matchWholeWords: false, caseSensitive: false });
    const idx = compileBookKeyIndex(b);
    expect(idx.buckets.size).toBe(0);
  });

  test("prefix keys (cat / category) both register independently", () => {
    const b = book("b", [
      entry("e1", { triggers: [{ keyword: "cat", isRegex: false }], matchWholeWords: false, caseSensitive: false }),
      entry("e2", { triggers: [{ keyword: "category", isRegex: false }], matchWholeWords: false, caseSensitive: false }),
    ]);
    const idx = compileBookKeyIndex(b);
    const hits = scanBookKeyIndex(idx, "a category error");
    expect(hits.has("cat", false, false)).toBe(true);
    expect(hits.has("category", false, false)).toBe(true);
  });

  test("two entries with different case/whole-word settings land in different buckets", () => {
    const b = book("b", [
      entry("e1", { triggers: [{ keyword: "dragon", isRegex: false }], matchWholeWords: true, caseSensitive: false }),
      entry("e2", { triggers: [{ keyword: "dragon", isRegex: false }], matchWholeWords: false, caseSensitive: true }),
    ]);
    const idx = compileBookKeyIndex(b);
    expect(idx.buckets.size).toBe(2);
    const hits = scanBookKeyIndex(idx, "xdragonx"); // glued: fails whole-word, passes substring
    expect(hits.has("dragon", false, true)).toBe(false);
    expect(hits.has("dragon", true, false)).toBe(true);
  });
});
