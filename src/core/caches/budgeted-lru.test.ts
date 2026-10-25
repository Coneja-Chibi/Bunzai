/** Budgeted LRU tests pin recency, eviction, and byte-budget behavior shared by core caches. */
import { describe, expect, test } from "bun:test";
import { createBudgetedLru } from "./budgeted-lru";

describe("get/set and LRU recency", () => {
  test("a hit moves the entry to the back; the oldest untouched entry evicts first", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 3, weightOf: () => 1 });
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("c", 3);
    lru.get("a"); // bump a to the back; b is now the oldest
    lru.set("d", 4); // over maxEntries: evicts the oldest, which is now b
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("a")).toBe(1);
    expect(lru.get("c")).toBe(3);
    expect(lru.get("d")).toBe(4);
  });

  test("replacing an existing key also moves it to the back", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 2, weightOf: () => 1 });
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("a", 99); // replace: a should now be MRU, b the oldest
    lru.set("c", 3); // evicts the oldest (b), not a
    expect(lru.get("b")).toBeUndefined();
    expect(lru.get("a")).toBe(99);
    expect(lru.get("c")).toBe(3);
  });

  test("never evicts the single most-recent entry, even far over budget", () => {
    const lru = createBudgetedLru<string, string>({ maxEntries: 1, maxWeightBytes: 1, weightOf: (_k, v) => v.length });
    lru.set("huge", "x".repeat(10_000));
    expect(lru.size).toBe(1);
    expect(lru.get("huge")).toBe("x".repeat(10_000));
  });
});

describe("maxEntries-only bound (no maxWeightBytes)", () => {
  test("self-enforces entry count on insert; bytes() still accumulates weight", () => {
    const lru = createBudgetedLru<string, string>({ maxEntries: 3, weightOf: (_k, v) => v.length });
    for (let i = 0; i < 10; i++) lru.set(`k${i}`, "xxxxx");
    expect(lru.size).toBe(3);
    expect(lru.bytes()).toBe(15); // 3 entries * 5 chars, even though no weight bound ever fired
  });
});

describe("maxWeightBytes bound", () => {
  test("evicts on weight overage even when entry count is under the cap", () => {
    const lru = createBudgetedLru<string, string>({ maxEntries: 100, maxWeightBytes: 10, weightOf: (_k, v) => v.length });
    lru.set("a", "12345");
    lru.set("b", "12345");
    expect(lru.bytes()).toBe(10);
    lru.set("c", "12345"); // pushes total to 15 > 10: evicts oldest (a)
    expect(lru.get("a")).toBeUndefined();
    expect(lru.bytes()).toBe(10);
  });
});

describe("bytes() and dropOldest()", () => {
  test("bytes() tracks the live sum, including after a drop and after a replace", () => {
    const lru = createBudgetedLru<string, string>({ maxEntries: 100, weightOf: (_k, v) => v.length });
    lru.set("a", "123");
    lru.set("b", "45");
    expect(lru.bytes()).toBe(5);
    lru.set("a", "1"); // shrink a's weight from 3 to 1; replacing also bumps a to the back, so b is oldest
    expect(lru.bytes()).toBe(3);
    expect(lru.dropOldest()).toBe(true); // drops b, the now-oldest entry
    expect(lru.bytes()).toBe(1);
  });

  test("dropOldest returns false on an empty cache or down to the last entry", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 100, weightOf: () => 1 });
    expect(lru.dropOldest()).toBe(false);
    lru.set("solo", 1);
    expect(lru.dropOldest()).toBe(false); // the floor: never evict the last entry via dropOldest
  });
});

describe("gate", () => {
  test("a closed gate makes every get() a miss without touching recency", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 10, weightOf: () => 1 });
    lru.set("a", 1);
    lru.setGate(() => false);
    expect(lru.get("a")).toBeUndefined();
    lru.setGate(() => true);
    expect(lru.get("a")).toBe(1); // still there: the closed gate never evicted it
  });

  test("a closed gate makes set() a pure no-op", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 10, weightOf: () => 1 });
    lru.setGate(() => false);
    lru.set("a", 1);
    expect(lru.size).toBe(0);
    expect(lru.bytes()).toBe(0);
  });
});

describe("insert hook", () => {
  test("fires once per real write, never on a no-op gated write", () => {
    const lru = createBudgetedLru<string, number>({ maxEntries: 10, weightOf: () => 1 });
    let fires = 0;
    lru.setInsertHook(() => { fires += 1; });
    lru.set("a", 1);
    expect(fires).toBe(1);
    lru.setGate(() => false);
    lru.set("b", 2);
    expect(fires).toBe(1); // gated: no real write, no hook
  });
});

describe("clear", () => {
  test("empties entries, size, and bytes", () => {
    const lru = createBudgetedLru<string, string>({ maxEntries: 10, weightOf: (_k, v) => v.length });
    lru.set("a", "hello");
    lru.clear();
    expect(lru.size).toBe(0);
    expect(lru.bytes()).toBe(0);
    expect(lru.get("a")).toBeUndefined();
  });
});
