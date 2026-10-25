/** The shape reader the legacy trackers keep their items in: one description checks what the store keeps (strict) and reads what a model sent (lenient). */
import { describe, expect, test } from "bun:test";
import { arr, bool, dflt, num, obj, oneOf, opt, rec, refine, str } from "./shape";

const item = obj({ name: str({ max: 20, min: 1 }), qty: num({ lo: 1, hi: 99, def: 1 }), kind: oneOf(["a", "b"] as const, "a"), tags: dflt(arr(str({ max: 10 }), 3), []), live: opt(bool()), needs: opt(rec(num({ lo: 0, hi: 100 }), 4)) });

const eq = (v: unknown): never => v as never;

describe("check: what the store keeps", () => {
  test("a complete item passes and comes back as a copy", () => {
    const v = { name: "Key", qty: 2, kind: "b", tags: ["x"] };
    expect(item.check(v)).toEqual(eq(v));
    expect(item.check(v)).not.toBe(v);
  });
  test("an unknown key, a wrong type, an out-of-range number, a missing required key, a long string and an over-long list are all refused", () => {
    const ok = { name: "Key", qty: 2, kind: "b", tags: [] };
    for (const bad of [{ ...ok, extra: 1 }, { ...ok, qty: "2" }, { ...ok, qty: 100 }, { ...ok, qty: Number.NaN }, { name: "Key", kind: "a", tags: [] }, { ...ok, name: "x".repeat(21) }, { ...ok, name: "" }, { ...ok, kind: "c" }, { ...ok, tags: ["1", "2", "3", "4"] }, { ...ok, tags: [3] }, { ...ok, name: "a\u0000b" }, [], null]) {
      expect(item.check(bad)).toBeNull();
    }
  });
  test("an optional key may be left out but not be the wrong type", () => {
    const ok = { name: "Key", qty: 2, kind: "b", tags: [] };
    expect(item.check({ ...ok, live: true })).toEqual(eq({ ...ok, live: true }));
    expect(item.check({ ...ok, live: "yes" })).toBeNull();
    expect(item.check({ ...ok, needs: { hunger: 40 } })).toEqual(eq({ ...ok, needs: { hunger: 40 } }));
    expect(item.check({ ...ok, needs: { hunger: 400 } })).toBeNull();
  });
});

describe("coerce: what a model sent", () => {
  test("unknown keys are dropped, numbers are read from text and clamped, enums match without case or spacing, missing keys take their default", () => {
    expect(item.coerce({ name: "  Key  ", qty: "500", kind: " B ", tags: ["x", 7, "y"], junk: true })).toEqual({ name: "Key", qty: 99, kind: "b", tags: ["x", "7", "y"] });
    expect(item.coerce({ name: "Key" })).toEqual({ name: "Key", qty: 1, kind: "a", tags: [] });
  });
  test("a required key with no default that the model left out makes the item unusable, never a made-up one", () => {
    expect(item.coerce({ qty: 3 })).toBeNull();
    expect(item.coerce({ name: "   " })).toBeNull();
    expect(item.coerce("a key")).toBeNull();
  });
  test("a string is cut to its maximum, a list to its maximum, a record to its maximum", () => {
    expect(item.coerce({ name: "x".repeat(50) })?.name).toHaveLength(20);
    expect(item.coerce({ name: "k", tags: ["a", "b", "c", "d", "e"] })?.tags).toEqual(["a", "b", "c"]);
    expect(Object.keys(item.coerce({ name: "k", needs: { a: 1, b: 2, c: 3, d: 4, e: 5 } })?.needs ?? {})).toHaveLength(4);
  });
  test("what coerce returns always passes check", () => {
    for (const raw of [{ name: "k", qty: "x", kind: 4, tags: "no", live: "true", needs: { a: "7", b: "z" } }, { name: "k", needs: { a: 900 } }]) {
      const made = item.coerce(raw);
      expect(made).not.toBeNull();
      expect(item.check(made)).toEqual(made);
    }
  });
});

describe("refine: a rule across fields", () => {
  const pair = refine(obj({ hp: num({ lo: 0, hi: 100 }), max: num({ lo: 1, hi: 100 }) }), { fix: (v) => ({ ...v, hp: Math.min(v.hp, v.max) }), valid: (v) => v.hp <= v.max });
  test("the store refuses what breaks the rule, and a model's answer is repaired to keep it", () => {
    expect(pair.check({ hp: 5, max: 3 })).toBeNull();
    expect(pair.check({ hp: 3, max: 5 })).toEqual({ hp: 3, max: 5 });
    expect(pair.coerce({ hp: 5, max: 3 })).toEqual({ hp: 3, max: 3 });
    expect(pair.coerce("no")).toBeNull();
  });
});
