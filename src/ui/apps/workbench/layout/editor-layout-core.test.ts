/** The EditorLayout core: which section is open, keyboard movement, bento split, meter fill. */
import { describe, expect, test } from "bun:test";
import { bentoColumns, meterPercent, navTarget, resolveActive, type EditorSection } from "./editor-layout-core";

const sec = (id: string, column?: 1 | 2): EditorSection => ({ id, title: id, node: null, column });

describe("resolveActive", () => {
  test("keeps a section that still exists, else falls back to the first, else null", () => {
    const list = [sec("a"), sec("b")];
    expect(resolveActive(list, "b")).toBe("b");
    expect(resolveActive(list, "gone")).toBe("a");
    expect(resolveActive(list, null)).toBe("a");
    expect(resolveActive([], "a")).toBeNull();
  });
});

describe("navTarget", () => {
  const ids = ["a", "b", "c"];
  test("arrows step and wrap, Home and End jump", () => {
    expect(navTarget(ids, "a", "ArrowDown")).toBe("b");
    expect(navTarget(ids, "c", "ArrowRight")).toBe("a");
    expect(navTarget(ids, "a", "ArrowUp")).toBe("c");
    expect(navTarget(ids, "b", "Home")).toBe("a");
    expect(navTarget(ids, "b", "End")).toBe("c");
  });
  test("any other key, or an unknown current id, is not a move", () => {
    expect(navTarget(ids, "a", "Enter")).toBeNull();
    expect(navTarget(ids, "zz", "ArrowDown")).toBeNull();
  });
});

test("bentoColumns keeps every section once, in order", () => {
  const [mid, right] = bentoColumns([sec("a"), sec("b", 2), sec("c", 1), sec("d", 2)]);
  expect(mid.map((s) => s.id)).toEqual(["a", "c"]);
  expect(right.map((s) => s.id)).toEqual(["b", "d"]);
});

test("meterPercent clamps and survives a bad range", () => {
  expect(meterPercent({ value: 5, min: 0, max: 10 })).toBe(50);
  expect(meterPercent({ value: 99, min: 0, max: 10 })).toBe(100);
  expect(meterPercent({ value: -3, min: 0, max: 10 })).toBe(0);
  expect(meterPercent({ value: 1, min: 4, max: 4 })).toBe(0);
  expect(meterPercent({ value: Number.NaN, min: 0, max: 1 })).toBe(0);
});
