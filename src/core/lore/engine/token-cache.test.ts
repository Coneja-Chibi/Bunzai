/**
 * M1 perf gate. The engine's explain path (`engine.ts`'s `skip`/verdict
 * closures) calls `options.countTokens(entry.content)` for every enabled entry, every turn, and the
 * real generation path always runs with `explain: true` (`assemble.ts`, `countTokens: countText`).
 * Before M1, `countText` was uncached BPE: an identical second turn over a large book re-encoded
 * every entry's content from scratch. Recorded RED against today's unmodified engine + a snapshot of
 * the old uncached `countText` (scratch measurement, not committed here): 1,000 real BPE calls on
 * BOTH turn 1 and turn 2 of an identical scan. This file is the GREEN gate: the second, identical
 * turn must do zero.
 */
import { describe, expect, test } from "bun:test";
import { __resetTokenCacheForTests, __tokenCacheStatsForTests, countText } from "../../tokens";
import { runLore } from "./engine";
import { book, entry, msg, scan } from "./_test-helpers";
import type { LorebookEntry } from "../../../entities/lorebook/schema";
import type { LoreRunOptions } from "./types";

const ENTRY_COUNT = 1000;

function bigBook() {
  const entries: LorebookEntry[] = Array.from({ length: ENTRY_COUNT }, (_, i) =>
    entry(`e${i}`, {
      content: `Entry content number ${i}: a bit of unique lore text so each entry differs, padded out to a realistic size. `.repeat(6),
    }),
  );
  return book("b1", entries);
}

const runOptions = (): LoreRunOptions => ({
  rng: () => 0,
  countTokens: countText,
  budgetTokens: Infinity,
  recentFires: [],
  explain: true,
  chance: "roll",
});

describe("M1 perf gate: lore engine token counting over 1,000 entries", () => {
  test("a second, identical activation does zero real BPE runs", () => {
    __resetTokenCacheForTests();
    const b = bigBook();
    const s = scan({ messages: [msg("a quiet evening in the tavern")] });

    const run1 = runLore([b], s, runOptions());
    expect(run1.verdicts).toHaveLength(ENTRY_COUNT); // explain: true covers every entry
    const afterTurn1 = __tokenCacheStatsForTests().realEncodes;
    // The first turn genuinely encoded: at least once per distinct entry content.
    expect(afterTurn1).toBeGreaterThanOrEqual(ENTRY_COUNT);

    const before = __tokenCacheStatsForTests().realEncodes;
    const run2 = runLore([b], s, runOptions()); // same book, same scan: nothing changed
    const afterTurn2 = __tokenCacheStatsForTests().realEncodes;
    expect(afterTurn2 - before).toBe(0); // the gate itself
    expect(run2.verdicts).toHaveLength(ENTRY_COUNT);
    expect(run2).toEqual(run1); // the cache changed nothing about what was returned
  }, 20_000);

  test("editing one entry's content re-encodes only that entry, not the other 999", () => {
    __resetTokenCacheForTests();
    const b = bigBook();
    const s = scan({ messages: [msg("a quiet evening in the tavern")] });
    runLore([b], s, runOptions());
    const before = __tokenCacheStatsForTests().realEncodes;

    const edited = book(
      "b1",
      b.body.entries.map((e, i) => (i === 0 ? { ...e, content: "a brand new line nobody has seen before" } : e)),
    );
    runLore([edited], s, runOptions());
    expect(__tokenCacheStatsForTests().realEncodes - before).toBe(1);
  }, 20_000);
});
