/**
 * Regression tests pinning lorebook-engine recursion rules: excludeRecursion gates the target
 * entry, and a vectorized entry's participation in recursion is one shared rule read by both the
 * runtime engine and the Workbench wake map, not two engines quietly disagreeing.
 */
import { describe, expect, test } from "bun:test";
import { runLore } from "./engine";
import { book, entry, fakeRng, msg, scan } from "./_test-helpers";
import type { LoreFire } from "./types";

const baseOptions = (patch: Partial<Parameters<typeof runLore>[2]> = {}) => ({
  rng: fakeRng(),
  countTokens: (s: string) => s.length,
  budgetTokens: Infinity,
  recentFires: [] as LoreFire[],
  ...patch,
});

describe("an excludeRecursion entry can never be woken by recursion", () => {
  // 's "Recursion algorithm": excludeRecursion is a property of the
  // entry that would be WOKEN - "candidates = entries where !excludeRecursion && ..." filters such
  // an entry out of the recursion candidate pool entirely, so no other entry's content can ever
  // chain-trigger it (it can still be found by a direct chat-text match, spec line 303). The flag
  // goes on the TARGET here, not the source - vectorized exclusion (covered in the next describe
  // block) is a source-side rule instead, and does not hold here.
  test("the excludeRecursion entry never wakes from another entry's content, even though it can still fire on a direct match", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }], excludeRecursion: true });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId)).toEqual(["gate"]);
  });

  test("control: without excludeRecursion the same content does wake the target entry", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId).sort()).toEqual(["gate", "woken"]);
  });
});

describe("a vectorized entry and recursion", () => {
  // FIXED: wake.ts (read by the Workbench lorebook editor's entry-rail wake map and web-view
  // recursion graph) hardcoded "vectorized entries never take part in recursion", while the real
  // runtime engine (engine.ts/recursion.ts) let them fire unconditionally - the two Bunzai
  // modules disagreed with no written tie-breaker. The owner's call: support BOTH as a user choice
  // (LorebookBody.vectorizedRecursion, entities/lorebook/
  // schema.ts), defaulting to true - today's ENGINE behavior, unchanged for every existing book.
  // engine.ts's recursionCandidates (recursion.ts) and wake.ts's loreWakeGraph both read the same
  // `vectorizedRecursionOk` predicate (engine/types.ts), so they can no longer disagree.
  test("by default (no vectorizedRecursion set) a vectorized entry still wakes another via recursion, unchanged from before this fix", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }], vectorized: true });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId).sort()).toEqual(["gate", "woken"]);
  });

  test("by default (no vectorizedRecursion set) a vectorized entry can still be woken via recursion, unchanged from before this fix", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }], vectorized: true });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId).sort()).toEqual(["gate", "woken"]);
  });

  test("vectorizedRecursion: false stops a vectorized entry's content from waking another via recursion", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }], vectorized: true });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true, vectorizedRecursion: false })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId)).not.toContain("woken");
  });

  test("vectorizedRecursion: false stops a vectorized entry from being woken via recursion", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }], vectorized: true });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true, vectorizedRecursion: false })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(run.injected.map((h) => h.entryId)).not.toContain("woken");
  });
});

describe("a delayed entry stays delayed when the book's recursion is on", () => {
  // The direct pass skips an entry until the scene has `delay` messages; the recursion pass built its
  // own candidate pool without that check, so with globalRecursion on the entry fired on its own chat
  // keyword the first turn, delay or not.
  const delayed = (messageCount: number, globalRecursion: boolean) => {
    const e = entry("late", { triggers: [{ keyword: "storm", isRegex: false }], delay: 5 });
    return runLore([book("b1", [e], { globalRecursion })], scan({ messages: [msg("the storm")], messageCount }), baseOptions()).injected.map((h) => h.entryId);
  };

  test("before its delay it does not fire, recursion on or off", () => {
    expect(delayed(2, false)).toEqual([]);
    expect(delayed(2, true)).toEqual([]);
  });

  test("once the scene reaches its delay it fires", () => {
    expect(delayed(5, true)).toEqual(["late"]);
  });
});
