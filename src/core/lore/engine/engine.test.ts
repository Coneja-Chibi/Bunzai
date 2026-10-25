/**
 * runLore integration: direct match, sticky/cooldown via recentFires, recursion, groups, the
 * priority/sortOrder budget (the plan's worked example), determinism under a seeded rng, and side
 * effects wired end to end. Ported scenarios from RoleCall's __tests__/engine.test.ts where the assertion still applies to canonical fields; RoleCall-only concerns (cross-
 * entry boosting, semantic retrieval, runtime-scope) are dropped, see the port report.
 */
import { describe, expect, test } from "bun:test";
import { runLore } from "./engine";
import { book, countChars, entry, fakeRng, msg, scan } from "./_test-helpers";
import type { LoreFire } from "./types";

/** Deterministic seeded PRNG (mulberry32) for the seed-determinism tests. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const baseOptions = (patch: Partial<Parameters<typeof runLore>[2]> = {}) => ({
  rng: fakeRng(),
  countTokens: countChars,
  budgetTokens: Infinity,
  recentFires: [] as LoreFire[],
  ...patch,
});

describe("runLore: direct matching", () => {
  test("a constant entry always injects with reason constant", () => {
    const e = entry("e1", { constant: true, content: "always here" });
    const books = [book("b1", [e])];
    const run = runLore(books, scan(), baseOptions());
    expect(run.injected).toHaveLength(1);
    expect(run.injected[0]?.reason).toBe("constant");
  });

  test("a keyword match injects with reason key", () => {
    const e = entry("e1", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const books = [book("b1", [e])];
    const run = runLore(books, scan({ messages: [msg("a dragon appeared")] }), baseOptions());
    expect(run.injected[0]?.reason).toBe("key");
    expect(run.injected[0]?.matched).toEqual(["dragon"]);
  });

  test("no keyword match, no injection, no entry in cut either", () => {
    const e = entry("e1", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore([book("b1", [e])], scan({ messages: [msg("a quiet day")] }), baseOptions());
    expect(run.injected).toHaveLength(0);
    expect(run.cut).toHaveLength(0);
  });

  test("a disabled entry never fires", () => {
    const e = entry("e1", { enabled: false, constant: true });
    const run = runLore([book("b1", [e])], scan(), baseOptions());
    expect(run.injected).toHaveLength(0);
  });

  test("a character filter blocks an entry for the wrong character", () => {
    const e = entry("e1", { constant: true, characterFilter: { names: ["Bram"], tags: [], isExclude: false } });
    const run = runLore([book("b1", [e])], scan({ character: { name: "Aria", tags: [], description: "", personality: "", scenario: "" } }), baseOptions());
    expect(run.injected).toHaveLength(0);
  });
});

describe("runLore: timers via recentFires", () => {
  test("sticky forces a reinjection with no key match and no new fire in the trace", () => {
    const e = entry("e1", { sticky: 3, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("nothing relevant")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(run.injected[0]?.reason).toBe("sticky");
    expect(run.fires[0]).toEqual({ entryKey: "b1:e1", fresh: false, keywords: [] });
  });

  test("cooldown blocks even a real key match", () => {
    const e = entry("e1", { sticky: 1, cooldown: 5, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 2, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(run.injected).toHaveLength(0);
  });
});

describe("runLore: recursion", () => {
  test("an entry's content wakes another entry when the book allows recursion", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    const ids = run.injected.map((h) => h.entryId).sort();
    expect(ids).toEqual(["gate", "woken"]);
    expect(run.injected.find((h) => h.entryId === "woken")?.reason).toBe("recursion");
  });

  test("recursion is skipped entirely when no book wants it", () => {
    const gate = entry("gate", { content: "dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore([book("b1", [gate, woken], { globalRecursion: false })], scan({ messages: [msg("show me the map")] }), baseOptions());
    expect(run.injected.map((h) => h.entryId)).toEqual(["gate"]);
  });
});

describe("runLore: inclusion groups", () => {
  test("only one entry per groupName injects", () => {
    const a = entry("a", { constant: true, groupName: "g", groupWeight: 100 });
    const b = entry("b", { constant: true, groupName: "g", groupWeight: 0 });
    const run = runLore([book("b1", [a, b])], scan(), baseOptions({ rng: fakeRng([0]) }));
    expect(run.injected).toHaveLength(1);
  });
});

describe("runLore: priority/sortOrder budget (the plan's worked example)", () => {
  test("sortOrder 1/2, priority 10/1: both fit, come out 1 then 2", () => {
    const e1 = entry("e1", { constant: true, sortOrder: 1, priority: 10, content: "aaaaa" });
    const e2 = entry("e2", { constant: true, sortOrder: 2, priority: 1, content: "bbbbb" });
    const run = runLore([book("b1", [e1, e2])], scan(), baseOptions({ budgetTokens: 100 }));
    expect(run.injected.map((h) => h.entryId)).toEqual(["e1", "e2"]);
  });

  test("a budget for only one: the priority-1 entry is cut, appears in cut", () => {
    const e1 = entry("e1", { constant: true, sortOrder: 1, priority: 10, content: "aaaaa" });
    const e2 = entry("e2", { constant: true, sortOrder: 2, priority: 1, content: "bbbbb" });
    const run = runLore([book("b1", [e1, e2])], scan(), baseOptions({ budgetTokens: 5 }));
    expect(run.injected.map((h) => h.entryId)).toEqual(["e1"]);
    expect(run.cut.map((h) => h.entryId)).toEqual(["e2"]);
  });

  test("an ignoreBudget entry survives a zero budget", () => {
    const e = entry("e1", { constant: true, ignoreBudget: true, content: "aaaaaaaaaa" });
    const run = runLore([book("b1", [e])], scan(), baseOptions({ budgetTokens: 0 }));
    expect(run.injected.map((h) => h.entryId)).toEqual(["e1"]);
  });
});

describe("runLore: seeded determinism", () => {
  const half = entry("e1", { triggerMode: "simple", probability: 50, triggers: [{ keyword: "dragon", isRegex: false }] });
  const books = [book("b1", [half])];
  const scanInput = scan({ messages: [msg("a dragon appeared")] });

  test("two runs with the same seed give identical results", () => {
    const a = runLore(books, scanInput, baseOptions({ rng: seededRng(42) }));
    const b = runLore(books, scanInput, baseOptions({ rng: seededRng(42) }));
    expect(a.injected.map((h) => h.entryId)).toEqual(b.injected.map((h) => h.entryId));
  });

  test("different seeds produce different outcomes for a 50% entry across 100 seeds", () => {
    const outcomes = new Set<boolean>();
    for (let seed = 0; seed < 100; seed++) {
      const run = runLore(books, scanInput, baseOptions({ rng: seededRng(seed) }));
      outcomes.add(run.injected.length === 1);
    }
    expect(outcomes.size).toBe(2);
  });

  test("a group pick with a fixed seed returns the same winner every time", () => {
    const a = entry("a", { constant: true, groupName: "g", groupWeight: 1 });
    const b = entry("b", { constant: true, groupName: "g", groupWeight: 1 });
    const winners = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const run = runLore([book("b1", [a, b])], scan(), baseOptions({ rng: seededRng(7) }));
      winners.add(run.injected[0]?.entryId ?? "");
    }
    expect(winners.size).toBe(1);
  });
});

describe("runLore: side effects", () => {
  test("an injecting entry's side effects are returned as ops, not applied", () => {
    const e = entry("e1", {
      constant: true,
      sideEffects: {
        effects: [{ type: "setvar", variable: "mood", value: "tense", scope: "local" }],
        onlyOnFirstTrigger: false,
        clearOnDeactivate: false,
      },
    });
    const run = runLore([book("b1", [e])], scan(), baseOptions());
    expect(run.sideEffects).toEqual([{ op: "set", name: "mood", value: "tense", scope: "local" }]);
  });
});
