/**
 * Regression: unbounded keyword-chaining recursion across lorebook entries needs a built-in stop
 * condition. Bunzai's recursion engine carries a hard MAX_RECURSION_DEPTH (see ./recursion.ts),
 * so this proves a mutually triggering pair of entries (A's content contains B's keyword and vice
 * versa) terminates quickly instead of looping, and that each entry only lands in the result once.
 */
import { describe, expect, test } from "bun:test";
import { evaluateWithRecursion } from "./recursion";
import { timersFrom } from "./timers";
import { book, entry, fakeRng, scan } from "./_test-helpers";

describe("recursion over a mutually-triggering pair is bounded", () => {
  test("A triggers B and B triggers A: evaluation terminates quickly with each entry hit exactly once", () => {
    const a = entry("a", { content: "mentions keyword-b right here", triggers: [{ keyword: "keyword-a", isRegex: false }] });
    const b = entry("b", { content: "mentions keyword-a right here", triggers: [{ keyword: "keyword-b", isRegex: false }] });
    const bk = book("b1", [a, b], { globalRecursion: true });
    const candidates = [a, b].map((e) => ({ book: bk, entry: e }));

    const hits = evaluateWithRecursion(
      candidates,
      { messages: [{ role: "user", content: "keyword-a" }] },
      scan(),
      fakeRng(),
      timersFrom([]),
    );

    expect(hits.map((h) => h.ref.entry.id).sort()).toEqual(["a", "b"]);
  });
});
