/**
 * Tests for the pure find rules: result filters and sort, wrap-around stepping, when Jump to latest shows, and how a
 * result's time and action text read.
 */
import { expect, test } from "bun:test";
import type { SceneSearchHit } from "../../../studio/scene-search";
import { filterCounts, kindOf, showJumpToLatest, stepResult, visibleHits } from "./scene-find-core";

const hit = (id: string, role: SceneSearchHit["role"], createdAt: number, thinking = false): SceneSearchHit =>
  ({ messageId: id, seq: createdAt, index: createdAt, role, createdAt, hidden: false, thinking, context: id });

const hits = [hit("a", "assistant", 5), hit("b", "user", 4), hit("c", "assistant", 3, true), hit("d", "system", 2), hit("e", "user", 1)];

test("a match in thinking filters as thinking even from the character; system lines only count under All", () => {
  expect(kindOf(hits[2]!)).toBe("thinking");
  expect(kindOf(hits[0]!)).toBe("character");
  expect(kindOf(hits[3]!)).toBeNull();
  expect(filterCounts(hits)).toEqual({ all: 5, character: 1, user: 2, thinking: 1 });
});

test("filters keep their kind and sort by time, newest first unless asked for oldest", () => {
  expect(visibleHits(hits, "all", "newest").map((h) => h.messageId)).toEqual(["a", "b", "c", "d", "e"]);
  expect(visibleHits(hits, "all", "oldest").map((h) => h.messageId)).toEqual(["e", "d", "c", "b", "a"]);
  expect(visibleHits(hits, "user", "newest").map((h) => h.messageId)).toEqual(["b", "e"]);
  expect(visibleHits(hits, "thinking", "newest").map((h) => h.messageId)).toEqual(["c"]);
  expect(hits.map((h) => h.messageId)).toEqual(["a", "b", "c", "d", "e"]);
});

test("stepping wraps at both ends and rests on zero with nothing to step", () => {
  expect(stepResult(2, 3, 1)).toBe(0);
  expect(stepResult(0, 3, -1)).toBe(2);
  expect(stepResult(1, 3, 1)).toBe(2);
  expect(stepResult(1, 3, -1)).toBe(0);
  expect(stepResult(0, 0, 1)).toBe(0);
});

test("Jump to latest shows past 64px from the bottom, and hides for a reader following a stream", () => {
  expect(showJumpToLatest(64, false)).toBe(false);
  expect(showJumpToLatest(65, false)).toBe(true);
  expect(showJumpToLatest(100, true)).toBe(false);
  expect(showJumpToLatest(161, true)).toBe(true);
  expect(showJumpToLatest(0, true)).toBe(false);
});

import { findStamp, scriptParts } from "./scene-find-core";

test("a result's time reads as RoleCall words it", () => {
  const now = new Date(2026, 9, 8, 15, 0);
  expect(findStamp(undefined, now)).toBe("");
  expect(findStamp(new Date(2026, 9, 8, 9, 5).getTime(), now)).toMatch(/9:05/);
  expect(findStamp(new Date(2026, 9, 7, 14, 0).getTime(), now)).toBe("Yesterday");
  expect(findStamp(new Date(2026, 9, 5, 15, 0).getTime(), now)).toBe(new Date(2026, 9, 5).toLocaleDateString([], { weekday: "short" }));
  expect(findStamp(new Date(2026, 8, 20, 15, 0).getTime(), now)).toBe(new Date(2026, 8, 20).toLocaleDateString([], { month: "short", day: "numeric" }));
});

test("an *(action)* in a result reads as an italic parenthetical and the rest stays", () => {
  expect(scriptParts("She *(tilts head)* and *smiles* at him.")).toEqual([
    { text: "She ", action: false }, { text: "(tilts head)", action: true }, { text: " and ", action: false },
    { text: "(smiles)", action: true }, { text: " at him.", action: false },
  ]);
  expect(scriptParts("plain")).toEqual([{ text: "plain", action: false }]);
});

test("a result with no usable time shows no stamp (dry audit A13)", () => {
  const now = new Date(2026, 9, 8, 12, 0);
  expect(findStamp(Number.POSITIVE_INFINITY, now)).toBe("");
  expect(findStamp(Number.NaN, now)).toBe("");
});
