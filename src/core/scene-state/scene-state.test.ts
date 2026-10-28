/**
 * Scene state's pure core: the three diff strategies cut a change into deltas and fold puts them back (removal markers
 * included), `defineSlot` refuses a bad declaration, and `rebuild` from a keyframe gives what a rebuild from nothing does.
 */
import { describe, expect, test } from "bun:test";
import type { JsonValue } from "../../stage/contracts/chat-store";
import { defineSlot } from "./define-slot";
import { diffSlot } from "./diff";
import { dropUnchanged, fold } from "./fold";
import { rebuild } from "./rebuild";
import { KEYFRAME_EVERY, type Delta, type SceneState, type SlotDef } from "./types";

const whole = defineSlot({ id: "t.whole", scope: "scene", diff: "value", default: { n: 0 } });
const fields = defineSlot({ id: "t.fields", scope: "scene", diff: "fields", default: {} });
const list = defineSlot({ id: "t.list", scope: "scene", diff: "keyed-list", key: "id", default: [] });
const slotOf = (id: string): SlotDef | undefined => [whole, fields, list].find((s) => s.id === id);

const set = (slot: string, path: string[], value: JsonValue, at = 1): Delta => ({ slot, path, value, at });
const unset = (slot: string, path: string[], at = 1): Delta => ({ slot, path, removed: true, at });

describe("defineSlot", () => {
  test("keeps a good declaration as it is", () => {
    expect(list).toEqual({ id: "t.list", scope: "scene", diff: "keyed-list", key: "id", default: [] });
  });

  test("refuses an id that is not a slot id, a keyed-list with no key, and a key on anything else", () => {
    for (const id of ["", "Vars", "1vars", "has space", "a".repeat(65)]) expect(() => defineSlot({ id, scope: "scene", diff: "value", default: 0 })).toThrow("must match");
    expect(() => defineSlot({ id: "ok", scope: "scene", diff: "keyed-list", default: [] })).toThrow("names its row key");
    expect(() => defineSlot({ id: "ok", scope: "scene", diff: "fields", key: "id", default: {} })).toThrow("only a keyed-list");
    expect(() => defineSlot({ id: "tracker:a.b-c_d", scope: "scene", diff: "value", default: 0 })).not.toThrow();
  });
});

describe("diffSlot", () => {
  test("value: nothing when equal whatever the key order, the whole value when not", () => {
    expect(diffSlot(whole, { a: 1, b: 2 }, { b: 2, a: 1 }, 5)).toEqual([]);
    expect(diffSlot(whole, { a: 1 }, { a: 2 }, 5)).toEqual([set("t.whole", [], { a: 2 }, 5)]);
  });

  test("fields: a delta for each field that is new or changed, a removal for each that is gone, none for the same value written earlier", () => {
    const before = { keep: { value: "k", createdAt: 1, updatedAt: 1 }, change: { value: 1, createdAt: 1, updatedAt: 1 }, drop: { value: true, createdAt: 1, updatedAt: 1 }, deep: { value: { a: 1, b: 2 }, createdAt: 1, updatedAt: 1 } };
    const after = { keep: "k", change: 2, fresh: [1], deep: { b: 2, a: 1 } };
    expect(diffSlot(fields, before as unknown as JsonValue, after, 9)).toEqual([set("t.fields", ["change"], 2, 9), set("t.fields", ["fresh"], [1], 9), unset("t.fields", ["drop"], 9)]);
    expect(diffSlot(fields, {}, {}, 9)).toEqual([]);
  });

  test("keyed-list: a delta for each row that is new or changed, a removal for each that is gone, rows are matched by key not by place", () => {
    const before = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }];
    const after = [{ id: "c", n: 3 }, { id: "a", n: 10 }, { id: "d", n: 4 }];
    expect(diffSlot(list, before, after, 9)).toEqual([set("t.list", ["a"], { id: "a", n: 10 }, 9), set("t.list", ["d"], { id: "d", n: 4 }, 9), unset("t.list", ["b"], 9)]);
    expect(diffSlot(list, before, [...before].reverse(), 9)).toEqual([]);
  });
});

describe("fold", () => {
  test("value: the delta replaces the whole value, and a removal puts the default back", () => {
    expect(fold({}, [set("t.whole", [], { n: 5 })], slotOf)).toEqual({ "t.whole": { n: 5 } });
    expect(fold({ "t.whole": { n: 5 } }, [unset("t.whole", [])], slotOf)).toEqual({ "t.whole": { n: 0 } });
  });

  test("fields: a field keeps its first time while its latest moves, and a removed one starts over when set again", () => {
    const out = fold({}, [set("t.fields", ["a"], 1, 10), set("t.fields", ["b"], "x", 11), set("t.fields", ["a"], 2, 20), unset("t.fields", ["b"], 21), set("t.fields", ["b"], "y", 30)], slotOf);
    expect(out).toEqual({ "t.fields": { a: { value: 2, createdAt: 10, updatedAt: 20 }, b: { value: "y", createdAt: 30, updatedAt: 30 } } });
  });

  test("fields: a name that is also an Object property is a plain name, and removing an absent one changes nothing", () => {
    const out = fold({}, [set("t.fields", ["__proto__"], 1), set("t.fields", ["constructor"], 2), unset("t.fields", ["never"])], slotOf);
    const state = out["t.fields"] as Record<string, { value: JsonValue }>;
    expect(Object.keys(state).sort()).toEqual(["__proto__", "constructor"]);
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(state, "__proto__")!.value.value).toBe(1);
  });

  test("keyed-list: a row is replaced in place, a new one goes last, a removal takes only that row", () => {
    const base: SceneState = { "t.list": [{ id: "a", n: 1 }, { id: "b", n: 2 }] };
    const out = fold(base, [set("t.list", ["a"], { id: "a", n: 9 }), set("t.list", ["c"], { id: "c", n: 3 }), unset("t.list", ["b"]), unset("t.list", ["zzz"])], slotOf);
    expect(out).toEqual({ "t.list": [{ id: "a", n: 9 }, { id: "c", n: 3 }] });
  });

  test("a delta for an unknown slot, or with a path its strategy cannot read, is skipped; the base is never changed", () => {
    const base: SceneState = { "t.fields": { a: { value: 1, createdAt: 1, updatedAt: 1 } } };
    const copy = structuredClone(base);
    const out = fold(base, [set("nope", ["a"], 1), set("t.fields", [], 1), set("t.fields", ["a", "b"], 1), set("t.whole", ["x"], 1), set("t.fields", ["z"], 2)], slotOf);
    expect(out).toEqual({ "t.fields": { a: { value: 1, createdAt: 1, updatedAt: 1 }, z: { value: 2, createdAt: 1, updatedAt: 1 } } });
    expect(base).toEqual(copy);
  });

  test("diff then fold lands on the value the writer held, for every strategy", () => {
    const wholeAfter = { n: 7, tags: ["a"] };
    expect(fold({}, diffSlot(whole, whole.default, wholeAfter, 1), slotOf)["t.whole"]).toEqual(wholeAfter);
    const rows = [{ id: "x", v: 1 }, { id: "y", v: 2 }];
    const withRows = fold({}, diffSlot(list, [], rows, 1), slotOf);
    expect(withRows["t.list"]).toEqual(rows);
    expect(fold(withRows, diffSlot(list, rows, [rows[1]!, { id: "z", v: 3 }], 2), slotOf)["t.list"]).toEqual([rows[1]!, { id: "z", v: 3 }]);
    const stored = fold({}, diffSlot(fields, {}, { p: 1, q: 2 }, 1), slotOf);
    expect(Object.fromEntries(Object.entries(fold(stored, diffSlot(fields, stored["t.fields"]!, { q: 2, r: 3 }, 2), slotOf)["t.fields"] as Record<string, { value: JsonValue }>).map(([k, v]) => [k, v.value]))).toEqual({ q: 2, r: 3 });
  });
});

describe("dropUnchanged", () => {
  const base: SceneState = { "t.fields": { a: { value: { x: 1, y: 2 }, createdAt: 1, updatedAt: 1 } }, "t.list": [{ id: "r", n: 1 }], "t.whole": { n: 5 } };

  test("a write of what is already there, or the removal of what is absent, records nothing, whatever the key order", () => {
    expect(dropUnchanged(base, [set("t.fields", ["a"], { y: 2, x: 1 }), unset("t.fields", ["nope"]), set("t.list", ["r"], { n: 1, id: "r" }), unset("t.list", ["nope"]), set("t.whole", [], { n: 5 })], slotOf)).toEqual([]);
  });

  test("a write that changes something is kept, each judged against what the ones before it leave", () => {
    const kept = dropUnchanged(base, [set("t.fields", ["a"], 1), set("t.fields", ["a"], 1), set("t.fields", ["b"], 2), unset("t.fields", ["b"]), unset("t.fields", ["b"]), set("t.list", ["r"], { id: "r", n: 2 })], slotOf);
    expect(kept.map((d) => [d.slot, d.path[0], d.removed ?? d.value])).toEqual([["t.fields", "a", 1], ["t.fields", "b", 2], ["t.fields", "b", true], ["t.list", "r", { id: "r", n: 2 }]]);
  });
});

describe("rebuild", () => {
  /** 130 shown messages; message i sets the field "m<i>" and, every seventh, "seven" to i. */
  const path = Array.from({ length: 130 }, (_, i) => ({ messageId: `m${i}`, swipeId: `s${i}` }));
  const all = new Map<string, Delta[]>(path.map((p, i) => [p.messageId, [set("t.fields", [`m${i}`], i, i + 1), ...(i % 7 === 0 ? [set("t.fields", ["seven"], i, i + 1)] : [])]]));
  const deltasOf = (shown: readonly { messageId: string }[]) => new Map(shown.map((v) => [v.messageId, all.get(v.messageId)!]));
  const plain = (s: SceneState) => Object.fromEntries(Object.entries(s["t.fields"] as Record<string, { value: JsonValue }>).map(([k, v]) => [k, v.value]));

  test("from nothing it folds every version in order and names a keyframe after every 50th message", () => {
    const { state, fresh } = rebuild({ path, keyframes: new Map(), deltasOf, slotOf });
    expect(plain(state)["seven"]).toBe(126);
    expect(Object.keys(plain(state))).toHaveLength(131);
    expect(fresh.map(([id]) => id)).toEqual(["m49", "m99"]);
    expect(KEYFRAME_EVERY).toBe(50);
  });

  test("from a keyframe it gives the same state, and asks only for the deltas after the keyframe", () => {
    const whole = rebuild({ path, keyframes: new Map(), deltasOf, slotOf });
    const asked: string[][] = [];
    const again = rebuild({ path, keyframes: new Map(whole.fresh), deltasOf: (shown) => (asked.push(shown.map((v) => v.messageId)), deltasOf(shown)), slotOf });
    expect(again.state).toEqual(whole.state);
    expect(asked[0]).toEqual(path.slice(100).map((p) => p.messageId));
    expect(again.fresh).toEqual([]);
  });

  test("the walk changes its own copy, never a keyframe handed in, and a keyframe it names is a copy that later deltas do not reach", () => {
    const frame: SceneState = { "t.fields": { a: { value: 1, createdAt: 1, updatedAt: 1 } } };
    const kept = structuredClone(frame);
    const two = Array.from({ length: 52 }, (_, i) => ({ messageId: `n${i}`, swipeId: `w${i}` }));
    const out = rebuild({
      path: [{ messageId: "k", swipeId: "sk" }, ...two],
      keyframes: new Map([["k", frame]]),
      deltasOf: () => new Map([["n0", [set("t.fields", ["a"], 2, 5)]], ["n51", [set("t.fields", ["a"], 3, 6), set("t.fields", ["b"], 4, 6)]]]),
      slotOf,
    });
    expect(frame).toEqual(kept);
    expect(plain(out.state)).toEqual({ a: 3, b: 4 });
    expect(out.fresh.map(([id]) => id)).toEqual(["n48"]);
    expect(plain(out.fresh[0]![1])).toEqual({ a: 2 }); // the state after message n48, not changed by what came after it
  });

  test("a keyframe for a message that is not on the path is ignored", () => {
    const { state } = rebuild({ path: path.slice(0, 10), keyframes: new Map([["m60", { "t.fields": { stale: { value: 1, createdAt: 1, updatedAt: 1 } } }]]), deltasOf, slotOf });
    expect(Object.keys(plain(state))).not.toContain("stale");
    expect(rebuild({ path: [], keyframes: new Map(), deltasOf, slotOf }).state).toEqual({});
  });
});
