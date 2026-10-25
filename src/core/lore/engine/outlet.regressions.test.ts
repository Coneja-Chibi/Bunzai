/**
 * Regression: two injected lorebook entries sharing an outlet title must not let the later one
 * silently overwrite the earlier one's outlet text mid-turn.
 */
import { describe, expect, test } from "bun:test";
import { expandLoreOutlets } from "./outlet";
import type { LoreHit, LoreRun } from "./types";

const hit = (title: string, content: string): LoreHit => ({
  entryKey: `b:${title}:${content}`,
  bookId: "b",
  entryId: `${title}-${content}`,
  title,
  content,
  position: { kind: "world" },
  tokens: 1,
  reason: "key",
  matched: [],
});

const runOf = (injected: LoreHit[]): LoreRun => ({ injected, cut: [], fires: [], sideEffects: [], totalTokens: 0 });

describe("a repeated outlet title does not clobber the first assignment", () => {
  test("two injected entries sharing a title keep the first one's content", () => {
    const run = runOf([hit("Shibuya", "first arrival"), hit("Shibuya", "second arrival, should not win")]);
    expect(expandLoreOutlets("{{lorebook:Shibuya}}", run)).toBe("first arrival");
  });
});
