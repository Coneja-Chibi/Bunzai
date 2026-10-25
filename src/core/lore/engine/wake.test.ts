/** loreWakeGraph: the engine's own recursion wake graph, ported from activation.ts's bookWakeGraph. */
import { describe, expect, test } from "bun:test";
import { loreWakeGraph } from "./wake";
import { book, entry } from "./_test-helpers";

describe("loreWakeGraph", () => {
  test("a three-entry chain returns the two wake edges", () => {
    const e1 = entry("e1", { content: "there is a lamp", triggers: [{ keyword: "start", isRegex: false }] });
    const e2 = entry("e2", { content: "the lamp reveals a key", triggers: [{ keyword: "lamp", isRegex: false }] });
    const e3 = entry("e3", { content: "the key opens nothing", triggers: [{ keyword: "key", isRegex: false }] });

    const edges = loreWakeGraph(book("b1", [e1, e2, e3]));

    expect(edges).toEqual([
      { from: "e1", to: "e2", keyword: "lamp" },
      { from: "e2", to: "e3", keyword: "key" },
    ]);
  });

  test("preventRecursion on the waker produces no outbound edge", () => {
    const gate = entry("gate", { content: "a hidden dragon", preventRecursion: true, triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const edges = loreWakeGraph(book("b1", [gate, woken]));
    expect(edges).toEqual([]);
  });

  test("excludeRecursion on the target produces no inbound edge", () => {
    const gate = entry("gate", { content: "a hidden dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { excludeRecursion: true, triggers: [{ keyword: "dragon", isRegex: false }] });
    const edges = loreWakeGraph(book("b1", [gate, woken]));
    expect(edges).toEqual([]);
  });

  // Bug 6: a vectorized entry's participation in recursion is a user
  // choice (LorebookBody.vectorizedRecursion), read through the same `vectorizedRecursionOk`
  // predicate the runtime engine's recursionCandidates uses (recursion.ts), so this map and the
  // engine can never disagree. Default (undefined) is true: today's engine behavior, unchanged.
  describe("vectorizedRecursion (bug 6)", () => {
    test("by default a vectorized entry both wakes and can be woken, matching the engine's default", () => {
      const gate = entry("gate", { content: "a hidden dragon", triggers: [{ keyword: "map", isRegex: false }], vectorized: true });
      const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }], vectorized: true });
      const edges = loreWakeGraph(book("b1", [gate, woken]));
      expect(edges).toEqual([{ from: "gate", to: "woken", keyword: "dragon" }]);
    });

    test("vectorizedRecursion: false removes a vectorized entry's outbound edge (it cannot wake)", () => {
      const gate = entry("gate", { content: "a hidden dragon", triggers: [{ keyword: "map", isRegex: false }], vectorized: true });
      const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
      const edges = loreWakeGraph(book("b1", [gate, woken], { vectorizedRecursion: false }));
      expect(edges).toEqual([]);
    });

    test("vectorizedRecursion: false removes a vectorized entry's inbound edge (it cannot be woken)", () => {
      const gate = entry("gate", { content: "a hidden dragon", triggers: [{ keyword: "map", isRegex: false }] });
      const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }], vectorized: true });
      const edges = loreWakeGraph(book("b1", [gate, woken], { vectorizedRecursion: false }));
      expect(edges).toEqual([]);
    });
  });
});
