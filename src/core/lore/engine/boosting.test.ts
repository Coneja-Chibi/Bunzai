/**
 * Cross-entry boosting (RoleCall selection/boosting.ts, engine.ts step 6): an entry that fires adds its `boostAmount` to the probability of each entry in its `boostIds`
 * that also matched this turn, additively, capped at 1, after groups and before the budget and the roll.
 * A target that did not match is not woken by it. The roll is the injected rng, so each case is exact.
 */
import { describe, expect, test } from "bun:test";
import { runLore } from "./engine";
import { book, entry, fakeRng, msg, scan } from "./_test-helpers";
import type { LoreFire } from "./types";

const run = (entries: ReturnType<typeof entry>[], said: string, rng: () => number, others: Parameters<typeof book>[2] = {}) =>
  runLore([book("b", entries, others)], scan({ messages: [msg(said)] }), { rng, countTokens: (s) => s.length, budgetTokens: Infinity, recentFires: [] as LoreFire[] }).injected.map((h) => h.entryId);

const source = (over: Partial<ReturnType<typeof entry>> = {}) => entry("src", { triggers: [{ keyword: "storm", isRegex: false }], boostIds: ["tgt"], boostAmount: 0.4, ...over });
const target = (over: Partial<ReturnType<typeof entry>> = {}) => entry("tgt", { triggers: [{ keyword: "storm", isRegex: false }], probability: 30, ...over });

describe("boosting", () => {
  test("a fired entry raises its target's chance: a roll of 0.5 misses 30% but lands under 30% + 40%", () => {
    expect(run([target()], "storm", fakeRng([0.5]))).toEqual([]); // control: no booster
    expect(run([source(), target()], "storm", fakeRng([0.5]))).toEqual(["src", "tgt"]);
  });
  test("boosts add up across sources and cap at 1", () => {
    const more = (id: string) => entry(id, { triggers: [{ keyword: "storm", isRegex: false }], boostIds: ["tgt"], boostAmount: 0.4 });
    const low = target({ probability: 10 });
    expect(run([source(), low], "storm", fakeRng([0.85]))).not.toContain("tgt"); // 0.1 + 0.4 = 0.5 < 0.85
    expect(run([source(), more("two"), low], "storm", fakeRng([0.85]))).toContain("tgt"); // 0.1 + 0.4 + 0.4 = 0.9 > 0.85
    expect(run([source(), more("two"), more("three"), low], "storm", fakeRng([0.9999]))).toContain("tgt"); // 1.3 is capped at 1, which always passes
  });
  test("a target that did not match is not woken", () => {
    expect(run([source(), target({ triggers: [{ keyword: "dragon", isRegex: false }] })], "storm", fakeRng([0]))).toEqual(["src"]);
  });
  test("no boost without an amount, or from an entry that did not fire", () => {
    expect(run([source({ boostAmount: 0 }), target()], "storm", fakeRng([0.5]))).toEqual(["src"]);
    expect(run([source({ triggers: [{ keyword: "dragon", isRegex: false }] }), target()], "storm", fakeRng([0.5]))).toEqual([]);
  });
  test("a boost reaches only entries of its own book", () => {
    const books = [book("a", [source()]), book("b", [target()])];
    const ids = runLore(books, scan({ messages: [msg("storm")] }), { rng: fakeRng([0.5]), countTokens: (s) => s.length, budgetTokens: Infinity, recentFires: [] }).injected.map((h) => h.entryId);
    expect(ids).toEqual(["src"]);
  });
  test("it counts after groups: a group loser gives no boost", () => {
    const a = source({ groupName: "g", groupWeight: 1 });
    const b = entry("other", { triggers: [{ keyword: "storm", isRegex: false }], groupName: "g", groupWeight: 1000000 });
    expect(run([a, b, target()], "storm", fakeRng([0.99, 0.5]))).not.toContain("tgt");
  });
});
