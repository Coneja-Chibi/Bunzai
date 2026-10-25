/**
 * The Model tab's flat row list: what shows, in RoleCall's order, for each state of the connections.
 */
import { describe, expect, test } from "bun:test";
import { modelRows, type RowInput } from "./model-rows-core";

const conns = [
  { id: "a", kind: "openai", label: "Harbor", model: "m1" },
  { id: "b", kind: "openai", label: "Lantern", model: "l1", unavailable: "No key" },
];
const base: RowInput = { conns, models: { a: { state: "ready", ids: [{ id: "m1" }, { id: "m2", label: "Mid Two" }] } }, favorites: [], current: undefined, query: "", filter: "all" };
const kinds = (i: Partial<RowInput>) => modelRows({ ...base, ...i }).map((r) => r.key);

describe("modelRows", () => {
  test("order is Currently Selected, Favorites, then each connection; an unusable connection says why", () => {
    expect(kinds({ current: { id: "a", model: "m1" }, favorites: ["a|m2"] })).toEqual(["hd-sel", "sel-a|m1", "hd-fav", "fav-a|m2", "hd-a", "a|m1", "a|m2", "hd-b", "na-b"]);
  });
  test("search narrows by id or display name and drops empty groups, but keeps Currently Selected", () => {
    expect(kinds({ query: "mid", current: { id: "a", model: "m1" } })).toEqual(["hd-sel", "sel-a|m1", "hd-a", "a|m2"]);
    expect(kinds({ query: "nothing" })).toEqual([]);
  });
  test("the provider filter shows one connection; a favourite from another is left out", () => {
    expect(kinds({ filter: "b", favorites: ["a|m1"] })).toEqual(["hd-b", "na-b"]);
  });
  test("a loading connection says so; a failed one keeps its saved model and a retry", () => {
    expect(kinds({ models: {} })).toEqual(["hd-a", "load-a", "hd-b", "na-b"]);
    const rows = modelRows({ ...base, models: { a: { state: "failed", why: "boom", saved: "m1" } } });
    expect(rows.map((r) => r.key)).toEqual(["hd-a", "note-a", "saved-a", "hd-b", "na-b"]);
    expect(rows[1]).toMatchObject({ kind: "note", retry: "a" });
  });
  test("the stated window travels with its model, and nothing is invented when none is stated", () => {
    const rows = modelRows({ ...base, models: { a: { state: "ready", ids: [{ id: "m1", context: 64000 }, { id: "m2" }] } } });
    expect(rows.filter((r) => r.kind === "model").map((r) => r.kind === "model" && r.window)).toEqual([64000, undefined]);
  });
});
