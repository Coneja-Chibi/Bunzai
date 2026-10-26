/** Canvas prefs: per-field fallbacks, unreadable board items kept verbatim, deterministic tidy, pinned notes. */
import { expect, test } from "bun:test";
import { applyDrag, parseCanvas, parseView, serializeCanvas, snapshotDrag, tidy } from "./canvas-state";

test("a view other than nodes reads as desk", () => {
  expect(parseView("nodes")).toBe("nodes");
  for (const raw of [undefined, "desk", "Nodes", 3, null]) expect(parseView(raw)).toBe("desk");
});

test("unusable prefs read as the defaults", () => {
  for (const raw of [undefined, null, "x", [], { v: 2, zoom: 0.5 }]) {
    const s = parseCanvas(raw);
    expect(s.layers).toEqual({ links: true, pipeline: true, board: true });
    expect([s.zoom, s.pan, s.board, s.unknownItems]).toEqual([1, [0, 0], [], []]);
  }
});

test("a record from a newer version shows the defaults but is frozen, so it is never saved over", () => {
  expect(parseCanvas({ v: 2, zoom: 0.5, board: [{ id: "n" }] }).frozen).toBe(true);
  for (const raw of [undefined, { v: 1 }, { v: "2" }, "x"]) expect(parseCanvas(raw).frozen).toBe(false);
});

test("a parsed board item keeps keys this build does not know and writes them back", () => {
  const note = { id: "n1", type: "note", x: 1, y: 2, w: 170, h: 110, text: "hi", color: "pink", meta: { by: "Chi" } };
  const s = parseCanvas({ v: 1, board: [note] });
  expect(s.board[0]!.text).toBe("hi");
  expect(serializeCanvas(s).board).toEqual([note]);
});

test("bad fields fall back one by one and good ones survive", () => {
  const s = parseCanvas({ v: 1, layers: { links: false, board: "no" }, zoom: 9, pan: [1, "x"], pos: { "a:1": [10, 20], "b:2": [1], "c:3": "no" } });
  expect(s.layers).toEqual({ links: false, pipeline: true, board: true });
  expect(s.zoom).toBe(2);
  expect(s.pan).toEqual([0, 0]);
  expect(s.pos).toEqual({ "a:1": [10, 20] });
});

test("board items that do not parse are kept and written back untouched", () => {
  const good = { id: "n1", type: "note" as const, x: 1, y: 2, w: 170, h: 110, text: "hi", pin: "character:c1" };
  const future = { id: "z", type: "sticker", x: 0, y: 0, w: 5, h: 5, extra: { deep: true } };
  const noSize = { id: "q", type: "note", x: 0, y: 0 };
  const s = parseCanvas({ v: 1, board: [good, future, "junk", noSize] });
  expect(s.board).toEqual([good]);
  expect(s.unknownItems).toEqual([future, "junk", noSize]);
  const out = serializeCanvas(s);
  expect(out.board).toEqual([good, future, "junk", noSize]);
  expect(parseCanvas(out)).toEqual(s);
});

const nodes = [
  { key: "lorebook:b2", kind: "lorebook", ghost: false },
  { key: "character:c1", kind: "character", ghost: false },
  { key: "regex:r1", kind: "regex", ghost: true },
  { key: "lorebook:b1", kind: "lorebook", ghost: false },
  { key: "persona:p1", kind: "persona", ghost: false },
];
const edges = [
  { from: "persona:p1", to: "lorebook:b2" },
  { from: "character:c1", to: "lorebook:b1" },
];

test("tidy puts sources in column 0, targets in column 1, ghosts after, and ignores input order", () => {
  const a = tidy(nodes, edges);
  expect(tidy([...nodes].reverse(), edges)).toEqual(a);
  expect(tidy(nodes, edges)).toEqual(a);
  expect(a["character:c1"]![0]).toBeLessThan(a["lorebook:b1"]![0]);
  expect(a["lorebook:b1"]![0]).toBeLessThan(a["regex:r1"]![0]);
  expect(a["character:c1"]![0]).toBe(a["persona:p1"]![0]);
  // targets follow the order of the piece that links them (c1 before p1), not their own keys
  expect(a["lorebook:b1"]![1]).toBeLessThan(a["lorebook:b2"]![1]);
  const column = Object.values(a).filter((p) => p[0] === a["character:c1"]![0]).map((p) => p[1]);
  expect(new Set(column).size).toBe(column.length);
});

test("dragging a node carries the notes pinned to it and nothing else", () => {
  const s = parseCanvas({ v: 1, board: [
    { id: "a", type: "note", x: 100, y: 100, w: 170, h: 110, pin: "character:c1" },
    { id: "b", type: "note", x: 500, y: 500, w: 170, h: 110, pin: "persona:p1" },
    { id: "c", type: "note", x: 900, y: 900, w: 170, h: 110 },
  ] });
  const snap = snapshotDrag(s, () => [10, 10], ["character:c1"], []);
  const moved = applyDrag(s, snap, 5, -5);
  expect(moved.pos["character:c1"]).toEqual([15, 5]);
  expect(moved.board.map((i) => [i.x, i.y])).toEqual([[105, 95], [500, 500], [900, 900]]);
  expect(s.pos).toEqual({});
});
