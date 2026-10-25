/** {{lorebook:Name}} expands from what actually injected this turn, not every enabled entry. */
import { describe, expect, test } from "bun:test";
import { expandLoreOutlets } from "./outlet";
import type { LoreHit, LoreRun } from "./types";

const hit = (title: string, content: string): LoreHit => ({
  entryKey: `b:${title}`,
  bookId: "b",
  entryId: title,
  title,
  content,
  position: { kind: "world" },
  tokens: 1,
  reason: "key",
  matched: [],
});

const runOf = (injected: LoreHit[]): LoreRun => ({ injected, cut: [], fires: [], sideEffects: [], totalTokens: 0 });

describe("expandLoreOutlets", () => {
  test("expands a matching title, case-insensitive", () => {
    const run = runOf([hit("JJK Shibuya", "the Shibuya incident")]);
    expect(expandLoreOutlets("Tell me about {{lorebook:jjk shibuya}}", run)).toBe("Tell me about the Shibuya incident");
  });

  test("leaves the macro untouched when nothing injected under that title", () => {
    const run = runOf([]);
    expect(expandLoreOutlets("{{lorebook:Nowhere}}", run)).toBe("{{lorebook:Nowhere}}");
  });

  test("an entry that only appears in cut is not expanded", () => {
    const run: LoreRun = { injected: [], cut: [hit("Cut Entry", "should not appear")], fires: [], sideEffects: [], totalTokens: 0 };
    expect(expandLoreOutlets("{{lorebook:Cut Entry}}", run)).toBe("{{lorebook:Cut Entry}}");
  });
});
