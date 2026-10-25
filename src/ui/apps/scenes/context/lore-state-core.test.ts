/** The Lore & state tabs' pure rules (rc-parity 08): Sources, Flow and Compose all read the one set of request blocks the assembler counted. */
import { describe, expect, test } from "bun:test";
import type { SceneTrace } from "../../../app-contract-scenes";
import { composeRows, flowBars, isHighlighted, sourceTree, totalTokens } from "./lore-state-core";

const trace = (): SceneTrace => ({
  reply: { messageId: "m", swipeId: "s", number: 2, model: "m", take: "t" },
  blocks: [
    { kind: "prompt", label: "Main Prompt", role: "system", tokens: 50, category: "preset", text: "main" },
    { kind: "prompt", label: "Character Description", role: "system", tokens: 100, category: "character", text: "desc" },
    { kind: "lore", label: "Mira", role: "system", tokens: 25, category: "lore" },
    { kind: "history", label: "Message 1", role: "user", tokens: 20, category: "history" },
    { kind: "history", label: "Message 2", role: "assistant", tokens: 5, category: "history" },
  ],
  window: { context: 8000, reply: 1000, stated: true },
  trimmed: 0, lore: null, rawAvailable: true, replies: [],
});

describe("totalTokens", () => {
  test("is the sum of the blocks the assembler counted", () => expect(totalTokens(trace())).toBe(200));
});

describe("sourceTree", () => {
  test("groups the blocks by what they are, in the Tokens sheet's order, each with its share of the request", () => {
    const tree = sourceTree(trace());
    expect(tree.map((n) => [n.category, n.label, n.tokens, n.percent])).toEqual([["preset", "Preset prompts", 50, 25], ["character", "Character card", 100, 50], ["lore", "Lore", 25, 13], ["history", "Chat history", 25, 13]]);
    expect(tree[3]!.children.map((c) => [c.index, c.label, c.tokens])).toEqual([[3, "Message 1", 20], [4, "Message 2", 5]]);
  });
  test("an empty request has no sources and no division by zero", () => {
    expect(sourceTree({ ...trace(), blocks: [] })).toEqual([]);
  });
});

describe("flowBars", () => {
  test("one bar per source, largest first, with the same percentages", () => {
    expect(flowBars(trace()).map((b) => [b.label, b.tokens, b.percent])).toEqual([["Character card", 100, 50], ["Preset prompts", 50, 25], ["Lore", 25, 13], ["Chat history", 25, 13]]);
  });
});

describe("composeRows", () => {
  test("the request in send order, numbered from 1, with each block's text only when the trace kept it", () => {
    const rows = composeRows(trace());
    expect(rows.map((r) => [r.position, r.label, r.tokens, r.percent])).toEqual([[1, "Main Prompt", 50, 25], [2, "Character Description", 100, 50], [3, "Mira", 25, 13], [4, "Message 1", 20, 10], [5, "Message 2", 5, 3]]);
    expect(rows[0]!.text).toBe("main");
    expect(rows[2]!.text).toBeUndefined();
  });
});

describe("isHighlighted", () => {
  test("a source highlights all its blocks; one block highlights only itself; nothing highlights nothing", () => {
    const rows = composeRows(trace());
    expect(rows.filter((r) => isHighlighted({ category: "history" }, r)).map((r) => r.position)).toEqual([4, 5]);
    expect(rows.filter((r) => isHighlighted({ category: "history", index: 4 }, r)).map((r) => r.position)).toEqual([5]);
    expect(rows.some((r) => isHighlighted(null, r))).toBe(false);
  });
});
