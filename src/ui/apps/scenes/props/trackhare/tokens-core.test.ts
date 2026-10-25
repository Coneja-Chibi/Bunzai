/** The Tokens sheet's pure math: totals, the what-if exclusion math, gradient stops, budget segments,
 * and the JSON/raw-request export shapes. */
import { describe, expect, test } from "bun:test";
import type { SceneTrace, TraceBlockView } from "../../../../app-contract-scenes";
import { budgetSegments, categoryTotals, effectiveTokens, gradientStops, legendOrder, loreBookGroups, numberRanges, rawRequestText, traceJsonText, usedPercent } from "./tokens-core";

const block = (over: Partial<TraceBlockView> = {}): TraceBlockView => ({
  kind: "prompt",
  label: "Main Prompt",
  role: "system",
  tokens: 100,
  category: "preset",
  ...over,
});

const trace = (over: Partial<SceneTrace> = {}): SceneTrace => ({
  reply: { messageId: "m1", swipeId: "s1", number: 14, model: "claude", take: "Director's Cut" },
  blocks: [
    block({ label: "Main Prompt", tokens: 420, category: "preset", role: "system", text: "Write in a literary register." }),
    block({ label: "Character card", tokens: 989, category: "character", role: "system", text: "Marguerite Vane, a keeper." }),
    block({ label: "The lighthouse", tokens: 120, category: "lore", role: "system", text: "The lighthouse text." }),
    block({ label: "Message 12", tokens: 2474, category: "history", role: "user", text: "You came up the stairs." }),
  ],
  window: { context: 32000, reply: 1200, stated: true },
  trimmed: 6,
  lore: { injected: [], cut: [], missed: [], chains: [], totalTokens: 120, share: 8000, seed: 1 },
  rawAvailable: true,
  replies: [],
  ...over,
});

describe("category totals", () => {
  test("sums tokens per category; zero where the trace sent none", () => {
    const totals = categoryTotals(trace().blocks);
    expect(totals.preset).toBe(420);
    expect(totals.character).toBe(989);
    expect(totals.lore).toBe(120);
    expect(totals.history).toBe(2474);
    expect(totals.persona).toBe(0);
    expect(totals.current).toBe(0);
    expect(totals.other).toBe(0);
  });
});

describe("legend order", () => {
  test("only categories with tokens, in the fixed order", () => {
    expect(legendOrder(categoryTotals(trace().blocks))).toEqual(["preset", "character", "lore", "history"]);
  });

  test("empty when nothing was sent", () => {
    expect(legendOrder(categoryTotals([]))).toEqual([]);
  });
});

describe("exclusion math (the what-if)", () => {
  test("excluding a category drops it from the effective total", () => {
    const totals = categoryTotals(trace().blocks);
    const grand = effectiveTokens(totals, new Set());
    expect(grand).toBe(420 + 989 + 120 + 2474);
    expect(effectiveTokens(totals, new Set(["lore"]))).toBe(grand - 120);
    expect(effectiveTokens(totals, new Set(["lore", "history"]))).toBe(grand - 120 - 2474);
  });

  test("used percent follows the effective total, not the raw one", () => {
    const totals = categoryTotals(trace().blocks);
    const grand = effectiveTokens(totals, new Set());
    expect(usedPercent(grand, 32000)).toBeCloseTo((grand / 32000) * 100);
    expect(usedPercent(effectiveTokens(totals, new Set(["lore"])), 32000)).toBeCloseTo(((grand - 120) / 32000) * 100);
    expect(usedPercent(100, 0)).toBe(0);
  });
});

describe("gradient stops", () => {
  test("sum to a full 100% and skip an excluded category", () => {
    const totals = categoryTotals(trace().blocks);
    const order = legendOrder(totals);

    const stops = gradientStops(totals, order, new Set());
    expect(stops.map((s) => s.category)).toEqual(order);
    expect(stops.reduce((sum, s) => sum + (s.endPct - s.startPct), 0)).toBeCloseTo(100);
    expect(stops.at(-1)!.endPct).toBe(100);

    const withExclusion = gradientStops(totals, order, new Set(["history"]));
    expect(withExclusion.map((s) => s.category)).toEqual(["preset", "character", "lore"]);
    expect(withExclusion.reduce((sum, s) => sum + (s.endPct - s.startPct), 0)).toBeCloseTo(100);
    expect(withExclusion.at(-1)!.endPct).toBe(100);
  });

  test("empty when everything is excluded or nothing was sent", () => {
    const totals = categoryTotals(trace().blocks);
    const order = legendOrder(totals);
    expect(gradientStops(totals, order, new Set(order))).toEqual([]);
    expect(gradientStops(categoryTotals([]), [], new Set())).toEqual([]);
  });
});

describe("budget segments", () => {
  test("one segment per non-excluded category, widths against the context window", () => {
    const totals = categoryTotals(trace().blocks);
    const order = legendOrder(totals);
    const segs = budgetSegments(totals, order, new Set(), 32000);
    expect(segs.map((s) => s.category)).toEqual(order);
    expect(segs.find((s) => s.category === "preset")!.widthPct).toBeCloseTo((420 / 32000) * 100);

    const withExclusion = budgetSegments(totals, order, new Set(["lore"]), 32000);
    expect(withExclusion.map((s) => s.category)).toEqual(["preset", "character", "history"]);
  });

  test("empty when the context window is unknown", () => {
    const totals = categoryTotals(trace().blocks);
    expect(budgetSegments(totals, legendOrder(totals), new Set(), 0)).toEqual([]);
  });
});

describe("export shapes", () => {
  test("the JSON export is the whole trace, verbatim", () => {
    const t = trace();
    expect(JSON.parse(traceJsonText(t))).toEqual(t);
  });

  test("the JSON export carries a null lore section untouched (no lore fired)", () => {
    const t = trace({ lore: null });
    expect(JSON.parse(traceJsonText(t)).lore).toBeNull();
  });

  test("the raw request joins block text in send order, a role line before each", () => {
    const text = rawRequestText(trace());
    expect(text).toBe(
      "[system] Main Prompt\nWrite in a literary register.\n\n"
      + "[system] Character card\nMarguerite Vane, a keeper.\n\n"
      + "[system] The lighthouse\nThe lighthouse text.\n\n"
      + "[user] Message 12\nYou came up the stairs.",
    );
  });

  test("no raw request when the trace carries no text (rawAvailable false)", () => {
    expect(rawRequestText(trace({ rawAvailable: false }))).toBeNull();
  });
});

// th-t4-gaps 4
describe("loreBookGroups", () => {
  const loreBlock = (label: string) => block({ label, category: "lore", tokens: 1 });
  const hit = (title: string, bookName: string) =>
    ({ bookId: "b", entryId: title, bookName, title, reason: "key" as const, matched: [], tokens: 1, place: "World", loop: 0 });

  test("groups lore blocks under the book of the hit whose title matches, each book in first-seen order", () => {
    const blocks = [loreBlock("The lighthouse"), loreBlock("The storm of '09")];
    const lore = { injected: [hit("The lighthouse", "Keeper's Log"), hit("The storm of '09", "The Drowned Coast")], cut: [], missed: [], chains: [], totalTokens: 2, share: 100, seed: 1 };
    const groups = loreBookGroups(blocks, lore);
    expect(groups.map((g) => g.bookName)).toEqual(["Keeper's Log", "The Drowned Coast"]);
    expect(groups[0]!.rows).toEqual([{ block: blocks[0]!, index: 0 }]);
    expect(groups[1]!.rows).toEqual([{ block: blocks[1]!, index: 1 }]);
  });

  test("a shared title still pairs correctly: each match consumes one hit, in order", () => {
    const blocks = [loreBlock("Echo"), loreBlock("Echo")];
    const lore = { injected: [hit("Echo", "Book A"), hit("Echo", "Book B")], cut: [], missed: [], chains: [], totalTokens: 2, share: 100, seed: 1 };
    const groups = loreBookGroups(blocks, lore);
    expect(groups.map((g) => g.bookName)).toEqual(["Book A", "Book B"]);
    expect(groups[0]!.rows[0]!.index).toBe(0);
    expect(groups[1]!.rows[0]!.index).toBe(1);
  });

  test("a block with no matching hit (an old trace, or a static lore anchor) falls into an unnamed group", () => {
    const blocks = [loreBlock("World Info")];
    const groups = loreBookGroups(blocks, null);
    expect(groups).toEqual([{ bookName: "", rows: [{ block: blocks[0]!, index: 0 }] }]);
  });

  test("the Compendium's recall block is its own group, and never takes a fired entry's book even when the title matches", () => {
    const recalled = block({ kind: "recall", label: "Recalled knowledge", category: "lore", tokens: 30 });
    const lore = { injected: [hit("Recalled knowledge", "Keeper's Log")], cut: [], missed: [], chains: [], totalTokens: 1, share: 100, seed: 1 };
    expect(loreBookGroups([loreBlock("The lighthouse"), recalled], lore).map((g) => g.bookName)).toEqual(["", "Recalled by the Compendium"]);
  });

  test("non-lore blocks are ignored", () => {
    expect(loreBookGroups([block({ category: "preset" })], null)).toEqual([]);
  });
});

describe("numberRanges", () => {
  test("consecutive message numbers read as ranges, in order, whatever order they come in", () => {
    expect(numberRanges([4, 2, 3, 7])).toBe("2-4, 7");
    expect(numberRanges([5])).toBe("5");
    expect(numberRanges([])).toBe("");
  });
});

describe("the trackers category", () => {
  test("the tracker Props' block is counted on its own line, between the current message and Other, and joins the legend only when it sent tokens", () => {
    const withTrackers = [...trace().blocks, block({ label: "Trackers", kind: "trackers", tokens: 30, category: "trackers" })];
    const totals = categoryTotals(withTrackers);
    expect(totals.trackers).toBe(30);
    expect(legendOrder(totals)).toEqual(["preset", "character", "lore", "history", "trackers"]);
    expect(effectiveTokens(totals, new Set(["trackers"]))).toBe(effectiveTokens(categoryTotals(trace().blocks), new Set()));
    expect(legendOrder(categoryTotals(trace().blocks))).not.toContain("trackers");
  });
});
