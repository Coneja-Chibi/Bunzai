/** Inclusion groups: one winner per groupName, weighted by groupWeight, drawn via rng. */
import { describe, expect, test } from "bun:test";
import { filterByGroupWinners, groupByGroupName, resolveInclusionGroups } from "./groups";
import { book, entry, fakeRng } from "./_test-helpers";

describe("groupByGroupName / resolveInclusionGroups / filterByGroupWinners", () => {
  test("a lone group member always wins", () => {
    const b = book("b1", [entry("a", { groupName: "g" })]);
    const cands = b.body.entries.map((e) => ({ ref: { book: b, entry: e }, probability: 1 }));
    const groups = groupByGroupName(cands);
    const winners = resolveInclusionGroups(groups, fakeRng());
    expect(winners.get("g")).toBe("b1:a");
  });

  test("ungrouped entries are never filtered out", () => {
    const b = book("b1", [entry("solo")]);
    const cands = b.body.entries.map((e) => ({ ref: { book: b, entry: e }, probability: 1 }));
    const kept = filterByGroupWinners(cands, new Map());
    expect(kept).toHaveLength(1);
  });

  test("weighted pick: a fixed rng deterministically selects by cumulative weight", () => {
    const b = book("b1", [
      entry("a", { groupName: "g", groupWeight: 10 }),
      entry("b", { groupName: "g", groupWeight: 90 }),
    ]);
    const cands = b.body.entries.map((e) => ({ ref: { book: b, entry: e }, probability: 1 }));
    const groups = groupByGroupName(cands);

    // roll = 0.05 * 100 = 5, which lands within a's [0,10) share.
    const winnersA = resolveInclusionGroups(groups, fakeRng([0.05]));
    expect(winnersA.get("g")).toBe("b1:a");

    // roll = 0.5 * 100 = 50, past a's share, lands on b.
    const winnersB = resolveInclusionGroups(groups, fakeRng([0.5]));
    expect(winnersB.get("g")).toBe("b1:b");
  });

  test("only the group's winner survives filterByGroupWinners", () => {
    const b = book("b1", [entry("a", { groupName: "g" }), entry("b", { groupName: "g" })]);
    const cands = b.body.entries.map((e) => ({ ref: { book: b, entry: e }, probability: 1 }));
    const winners = new Map([["g", "b1:a"]]);
    const kept = filterByGroupWinners(cands, winners);
    expect(kept.map((c) => c.ref.entry.id)).toEqual(["a"]);
  });
});
