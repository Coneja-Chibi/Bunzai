/**
 * The small type guards every format, entity, and UI reader shares. `deepEq` gets the most
 * scrutiny: it was hoisted unchanged from formats/_shared/tavern-fields.ts's `same`, and its exact
 * semantics (key order, arrays, undefined fields, NaN) are pinned here before any caller moves onto
 * it, so a future "simplification" cannot silently change behavior underneath a format adapter.
 */
import { describe, expect, test } from "bun:test";
import {
  boolFromWire,
  boolOr,
  deepEq,
  hasErrorName,
  isOneOf,
  isPlainObject,
  isRecord,
  numOr,
  numOrNull,
  presentBool,
  presentNum,
  presentStrArray,
  presentStr,
  recArray,
  recOr,
  strArray,
  strOr,
} from "./guards";

describe("strOr", () => {
  test("passes through a string, falls back otherwise", () => {
    expect(strOr("hi", "x")).toBe("hi");
    expect(strOr(5, "x")).toBe("x");
    expect(strOr(undefined, "x")).toBe("x");
  });
});

describe("numOr / numOrNull", () => {
  test("accepts a finite number, rejects NaN and Infinity", () => {
    expect(numOr(3, 0)).toBe(3);
    expect(numOr(NaN, 0)).toBe(0);
    expect(numOr(Infinity, 0)).toBe(0);
    expect(numOr("3", 0)).toBe(0);
  });
  test("numOrNull falls back to null instead of a caller-given default", () => {
    expect(numOrNull(3)).toBe(3);
    expect(numOrNull(NaN)).toBeNull();
    expect(numOrNull("3")).toBeNull();
  });
});

describe("present*", () => {
  test("presentStr/Num/Bool return undefined for an unauthored or wrong-typed field", () => {
    expect(presentStr("a")).toBe("a");
    expect(presentStr(1)).toBeUndefined();
    expect(presentNum(1)).toBe(1);
    expect(presentNum(NaN)).toBeUndefined();
    expect(presentBool(true)).toBe(true);
    expect(presentBool("true")).toBeUndefined();
  });
});

describe("strArray / recArray", () => {
  test("drop non-matching entries instead of throwing", () => {
    expect(strArray(["a", 1, "b", null])).toEqual(["a", "b"]);
    expect(strArray("not an array")).toEqual([]);
    expect(recArray([{ a: 1 }, "x", null, [1, 2]])).toEqual([{ a: 1 }]);
    expect(recArray(null)).toEqual([]);
  });
});

describe("boolFromWire", () => {
  test("accepts the storage-layer true and its pre-deserialization string spelling", () => {
    expect(boolFromWire(true)).toBe(true);
    expect(boolFromWire("true")).toBe(true);
    expect(boolFromWire(false)).toBe(false);
    expect(boolFromWire("false")).toBe(false);
    expect(boolFromWire(1)).toBe(false);
  });
});

describe("isOneOf", () => {
  test("narrows to the given literal set", () => {
    expect(isOneOf("user", ["system", "user", "assistant"] as const)).toBe(true);
    expect(isOneOf("admin", ["system", "user", "assistant"] as const)).toBe(false);
    expect(isOneOf(5, ["system", "user", "assistant"] as const)).toBe(false);
  });
});

describe("hasErrorName", () => {
  test("matches structural error objects by name", () => {
    expect(hasErrorName({ name: "ArchiveLimitError" }, "ArchiveLimitError")).toBe(true);
    expect(hasErrorName(new Error("broken"), "Error")).toBe(true);
    expect(hasErrorName({ name: "OtherError" }, "ArchiveLimitError")).toBe(false);
  });

  test("rejects null and primitive values", () => {
    expect(hasErrorName(null, "Error")).toBe(false);
    expect(hasErrorName(undefined, "Error")).toBe(false);
    expect(hasErrorName("Error", "Error")).toBe(false);
  });
});

describe("deepEq", () => {
  test("is key-order-safe, unlike JSON.stringify equality", () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(JSON.stringify(a) === JSON.stringify(b)).toBe(false); // the bug this guards against
    expect(deepEq(a, b)).toBe(true);
  });

  test("arrays compare by position, not just length", () => {
    expect(deepEq([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEq([1, 2, 3], [3, 2, 1])).toBe(false);
    expect(deepEq([1, 2], [1, 2, 3])).toBe(false);
  });

  test("a missing key and an explicit undefined value compare equal", () => {
    expect(deepEq({ a: undefined }, {})).toBe(true);
    expect(deepEq({ a: 1 }, {})).toBe(false);
  });

  test("NaN is never equal to itself, matching the hoisted `same` behavior", () => {
    expect(deepEq(NaN, NaN)).toBe(false);
  });

  test("nested structures compare recursively", () => {
    expect(deepEq({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEq({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  test("different types never compare equal", () => {
    expect(deepEq("1", 1)).toBe(false);
    expect(deepEq(null, undefined)).toBe(false);
    expect(deepEq([1], { 0: 1 })).toBe(false);
  });
});

describe("isRecord (existing guard, kept for regression coverage)", () => {
  test("plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});

describe("presentStrArray", () => {
  test("keeps the string members of an array and leaves absent as undefined", () => {
    expect(presentStrArray(["a", 1, null, "b"])).toEqual(["a", "b"]);
    expect(presentStrArray([])).toEqual([]);
    for (const bad of [undefined, null, "a", { 0: "a" }, 3]) expect(presentStrArray(bad)).toBeUndefined();
  });
});

describe("recOr / boolOr / isPlainObject", () => {
  test("recOr keeps a plain object and replaces everything else with a fresh {}", () => {
    const o = { a: 1 };
    expect(recOr(o)).toBe(o);
    for (const bad of [null, undefined, [], [1], "s", 3, true]) expect(recOr(bad)).toEqual({});
    expect(recOr(null)).not.toBe(recOr(null));
    expect([{ a: 1 }, 5, null].map(recOr)).toEqual([{ a: 1 }, {}, {}]);
  });
  test("boolOr accepts only real booleans", () => {
    expect(boolOr(true, false)).toBe(true);
    expect(boolOr(false, true)).toBe(false);
    for (const bad of ["true", 1, 0, null, undefined]) expect(boolOr(bad, true)).toBe(true);
    expect(boolOr("false", false)).toBe(false);
  });
  test("isPlainObject rejects class instances, Map, Date, arrays and null-prototype objects", () => {
    class Box {}
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: { b: 1 } })).toBe(true);
    for (const bad of [new Box(), new Map(), new Date(), [], null, undefined, "s", Object.create(null)]) {
      expect(isPlainObject(bad)).toBe(false);
    }
  });
});
