/**
 * The summary slot's rows (core/summary/rows.ts): generated rows are keyed by the version they end at, the person's text is its own row with a fresh edit id, each generated row records the edit it saw,
 * and the take's text is the person's text then the generated rows that saw it. No clock decides the order, and no list grows with the number of rows. The slot's shape is checked by the stores on every write.
 */
import { expect, test } from "bun:test";
import { fold } from "../scene-state/fold";
import { slotOf } from "../../generated/slots";
import type { SceneState } from "../scene-state/types";
import { PERSON, blockDeltas, editOf, layersOf, personDeltas, sawOf, takeOf } from "./rows";
import { summaryRowShape, type SummaryRow } from "./row-shape";

const row = (version: string, text: string, through: number, at: number, extra: Partial<SummaryRow> = {}): SummaryRow => ({ version, text, through, at, ...extra });
const mine = (text: string, edit: string, n = 1, at = 5): SummaryRow => row(PERSON, text, 2, at, { edit, n });
const stateOf = (rows: SummaryRow[]): SceneState => ({ summary: rows as never });
const apply = (state: SceneState, deltas: ReturnType<typeof blockDeltas>): SceneState => fold(state, deltas, slotOf);

test("no rows is no summary, and the text is the generated rows in order, reaching as far as the last and as new as the newest", () => {
  expect(takeOf(null)).toBeNull();
  expect(takeOf(stateOf([]))).toBeNull();
  expect(takeOf(stateOf([row("a", "Turn 1: x", 2, 30), row("b", "Turn 2: y", 4, 20)]))).toEqual({ text: "Turn 1: x\nTurn 2: y", through: 4, at: 30, last: "b" });
});

test("a block removes the other generated rows and sets its own; without replace it only adds", () => {
  const state = stateOf([row("a", "one", 2, 1), row("b", "two", 4, 2)]);
  const block = row("c", "all", 6, 3, { replace: true });
  const deltas = blockDeltas(state, block);
  expect(deltas.map((d) => [d.path[0], d.removed === true])).toEqual([["a", true], ["b", true], ["c", false]]);
  expect(layersOf(apply(state, deltas)).rows.map((r) => r.version)).toEqual(["c"]);
  expect(layersOf(apply(state, blockDeltas(state, row("c", "all", 6, 3)))).rows.map((r) => r.version)).toEqual(["a", "b", "c"]);
});

test("a block never writes the person's path, and the person's text never writes a generated path", () => {
  const state = stateOf([row("a", "one", 2, 1), mine("Mine.", "e1")]);
  expect(blockDeltas(state, row("c", "all", 6, 3, { replace: true })).map((d) => d.path[0])).toEqual(["a", "c"]);
  expect(personDeltas(state, { text: "Again.", through: 3 }, 9, "e2").map((d) => d.path)).toEqual([[PERSON]]);
  expect(editOf(state)).toBe("e1");
  expect(editOf(stateOf([]))).toBeUndefined();
});

test("the person's text comes first; generated rows written before it are covered, and rows that saw it show", () => {
  const state = stateOf([row("a", "Turn 1: x", 2, 1), row("b", "Turn 2: y", 4, 6, { saw: "e1", sawN: 1 }), mine("Mine.", "e1")]);
  expect(takeOf(state)).toMatchObject({ text: "Mine.\nTurn 2: y", through: 4, last: "b" });
});

test("clearing is empty person text: nothing written before shows, and a row written after it does", () => {
  const state = stateOf([row("a", "Turn 1: x", 2, 1)]);
  const cleared = apply(state, personDeltas(state, null, 5, "e1"));
  expect(takeOf(cleared)).toBeNull();
  expect(takeOf(apply(cleared, blockDeltas(cleared, row("b", "Turn 1: y", 2, 6, sawOf(cleared)))))).toMatchObject({ text: "Turn 1: y" });
  expect(personDeltas(stateOf([]), null, 5, "e1")).toEqual([]);
});

test("a replacing block that saw the person's text stands in for it; one written before the save is covered by it", () => {
  expect(takeOf(stateOf([mine("Mine.", "e1"), row("b", "Block.", 4, 11, { replace: true, saw: "e1", sawN: 1 })]))!.text).toBe("Block.");
  expect(takeOf(stateOf([mine("Mine.", "e2", 2), row("b", "Block.", 4, 11, { replace: true, saw: "e1", sawN: 1 })]))!.text).toBe("Mine.");
  expect(takeOf(stateOf([mine("Mine.", "e1"), row("b", "Block.", 4, 11, { replace: true })]))!.text).toBe("Mine.");
});

test("each save is a new edit, whatever the clock says, so a later save is never mistaken for the one a block saw", () => {
  const first = apply(stateOf([]), personDeltas(stateOf([]), { text: "One.", through: 1 }, 5, "e1"));
  const second = apply(first, personDeltas(first, { text: "Two.", through: 1 }, 5, "e2")); // the same time, a different edit
  expect(editOf(first)).toBe("e1");
  expect(editOf(second)).toBe("e2");
  expect(layersOf(second).person!.n).toBe(2);
  expect(takeOf(apply(second, blockDeltas(second, row("b", "Block.", 4, 6, { replace: true, saw: "e1", sawN: 1 }))))!.text).toBe("Two.");
});

test("a person's save is one small row however many rows it covers: a very large take is covered in memory without a list", () => {
  const many = Array.from({ length: 50_000 }, (_, i) => row(`v${i}`, `Turn ${i}`, i, i));
  const state = stateOf(many);
  const deltas = personDeltas(state, { text: "Mine.", through: 9 }, 99, "e1");
  expect(deltas).toHaveLength(1);
  expect(JSON.stringify(deltas).length).toBeLessThan(400);
  expect(takeOf(apply(state, deltas))!.text).toBe("Mine.");
  const cleared = apply(state, personDeltas(state, null, 99, "e1"));
  expect(takeOf(cleared)).toBeNull();
  expect(takeOf(apply(cleared, blockDeltas(cleared, row("new", "New line.", 1, 100, { saw: "e1", sawN: 1 }))))!.text).toBe("New line.");
});

test("the saves form a chain by number: once the newest save is gone, rows that saw it still show, and rows that saw the older one show too", () => {
  const rows = [row("r1", "R1", 1, 1), row("r2", "R2", 2, 2, { saw: "e1", sawN: 1 }), row("r3", "R3", 3, 3, { saw: "e2", sawN: 2 })];
  expect(takeOf(stateOf([...rows, mine("New.", "e2", 2)]))!.text).toBe("New.\nR3"); // R1 and R2 were written before New
  expect(takeOf(stateOf([...rows, mine("Old.", "e1", 1)]))!.text).toBe("Old.\nR2\nR3"); // New is gone: R3 saw a newer text and still shows
});

test("the slot's shape takes a row and nothing else", () => {
  expect(summaryRowShape.check(row("a", "x", 1, 1))).not.toBeNull();
  expect(summaryRowShape.check(row("a", "x", 1, 1, { edit: "e", n: 2, saw: "s", sawN: 1, replace: true }))).not.toBeNull();
  for (const bad of [{ ...row("a", "x", 1, 1), extra: 1 }, { ...row("a", "x", 1, 1), covers: ["b"] }, { ...row("a", "x", 1, 1), through: 1.5 }, { ...row("a", "x", 1, 1), text: 4 }, row("", "x", 1, 1), { text: "x" }, "x"]) expect(summaryRowShape.check(bad)).toBeNull();
});
