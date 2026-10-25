/** The Regex tab's list rules (RoleCall's RegexPanel): saved order, drag reorder, and what the fold says. Pure. */
import { expect, test } from "bun:test";
import { inSavedOrder, movedTo, selectedInOrder, regexTabMeta } from "./scene-regex-core";

const rows = ["a", "b", "c", "d"].map((id) => ({ id }));

test("the library list follows the saved order, and a set the order has never seen comes after, in library order", () => {
  expect(inSavedOrder(rows, ["c", "a"]).map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
  expect(inSavedOrder(rows, undefined).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  expect(inSavedOrder(rows, ["zzz", 7, "b"]).map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
});

test("a drag moves one set to the place of another, as dnd-kit's arrayMove does", () => {
  expect(movedTo(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
  expect(movedTo(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  expect(movedTo(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  expect(movedTo(["a", "b"], "x", "b")).toEqual(["a", "b"]);
});

test("a reorder tells the scene only about the selected sets, in the new list order", () => {
  expect(selectedInOrder(["d", "a", "c", "b"], ["b", "d"])).toEqual(["d", "b"]);
});

test("the fold says how many sets the scene has on", () => {
  expect(regexTabMeta(0)).toBe("0 active");
  expect(regexTabMeta(3)).toBe("3 active");
});
