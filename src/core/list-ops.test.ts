/** Shared list operation tests pin movement, lookup, grouping, ids, and duplicate handling. */
import { describe, expect, test } from "bun:test";
import { getOrCreate, groupBy, idOrIndex, moveItem, requireItem, uniqueId } from "./list-ops";

describe("moveItem", () => {
  test("lifts an item and reinserts it at the target index", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  test("clamps an out-of-range target instead of throwing", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
  });

  test("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("requireItem", () => {
  test("returns the first match", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(requireItem(items, (x) => x.id === "b", "missing")).toBe(items[1]!);
  });

  test("throws the given message when nothing matches", () => {
    expect(() => requireItem([{ id: "a" }], (x) => x.id === "z", 'item "z" does not exist'))
      .toThrow('item "z" does not exist');
  });

  test("returns a matching falsy value", () => {
    expect(requireItem([0, 1], (value) => value === 0, "missing")).toBe(0);
    expect(requireItem([false, true], (value) => !value, "missing")).toBe(false);
    expect(requireItem([undefined], (value) => value === undefined, "missing")).toBeUndefined();
  });
});

describe("getOrCreate", () => {
  test("creates and stores the default only once", () => {
    const map = new Map<string, number[]>();
    getOrCreate(map, "a", () => []).push(1);
    getOrCreate(map, "a", () => []).push(2);
    expect(map.get("a")).toEqual([1, 2]);
  });

  test("an existing falsy-but-defined value is not recreated", () => {
    const map = new Map<string, number>([["a", 0]]);
    let factoryCalls = 0;
    const v = getOrCreate(map, "a", () => { factoryCalls += 1; return 99; });
    expect(v).toBe(0);
    expect(factoryCalls).toBe(0);
  });
});

describe("groupBy", () => {
  test("buckets items by key, preserving relative order within each bucket", () => {
    const items = [{ k: "x", v: 1 }, { k: "y", v: 2 }, { k: "x", v: 3 }];
    const groups = groupBy(items, (i) => i.k);
    expect(groups.get("x")!.map((i) => i.v)).toEqual([1, 3]);
    expect(groups.get("y")!.map((i) => i.v)).toEqual([2]);
  });
});

describe("idOrIndex", () => {
  test("stringifies a present id, falls back to the index otherwise", () => {
    expect(idOrIndex("abc", 5)).toBe("abc");
    expect(idOrIndex(42, 5)).toBe("42");
    expect(idOrIndex(undefined, 5)).toBe("5");
    expect(idOrIndex(null, 5)).toBe("5");
  });
});

describe("uniqueId", () => {
  test("returns the candidate untouched when it is free", () => {
    expect(uniqueId(new Set(), "x", (c, n) => `${c}-${n}`)).toBe("x");
  });

  test("bumps past every id already taken", () => {
    const taken = new Set(["x", "x-2", "x-3"]);
    expect(uniqueId(taken, "x", (c, n) => `${c}-${n}`)).toBe("x-4");
  });

  test("the bump strategy is caller-chosen (underscore separator, say)", () => {
    const taken = new Set(["x", "x_2"]);
    expect(uniqueId(taken, "x", (c, n) => `${c}_${n}`)).toBe("x_3");
  });
});
