/** accentVars: a piece accent's --a-deep comes from accentRole under the active theme's floors, like the scoped accents. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parsePalette } from "../../extensions/theme-appearance";
import { accentRole, floorsOf } from "./accent-role";
import { deepAccent } from "./color-math";
import { accentVars } from "./decks";

const palette = parsePalette((JSON.parse(readFileSync(new URL("../../extensions/themes/greenroom/manifest.json", import.meta.url), "utf8")) as { appearance: { palette: unknown } }).appearance.palette);
const floors = floorsOf(palette);

describe("accentVars", () => {
  test("a piece accent that fails the theme floor is nudged, not deepened bare", () => {
    const vars = accentVars("#000000", floors)!;
    expect(deepAccent("#000000")).toBe("#000000"); // the old bare path
    expect(vars["--a"]).toBe("#000000");
    expect(vars["--a-deep"]).toBe(accentRole("#000000", floors)!.deep);
    expect(vars["--a-deep"]).not.toBe("#000000");
  });
  test("a piece accent that already clears the floors keeps the same deep tone", () => {
    expect(accentVars("#ff9ebb", floors)!["--a-deep"]).toBe(accentRole("#ff9ebb", floors)!.deep);
  });
  test("without readable floors a hex accent paints only --a, so CSS falls back to the theme's deep accent", () => {
    expect(accentVars("#336699", null)).toEqual({ "--a": "#336699" });
  });
  test("a deck accent still points at its token twin, and nothing yields nothing", () => {
    expect(accentVars("var(--deck-lorebook)", floors)).toEqual({ "--a": "var(--deck-lorebook)", "--a-deep": "var(--deck-lorebook-deep)" });
    expect(accentVars(undefined, floors)).toBeUndefined();
    expect(accentVars("teal", floors)).toEqual({ "--a": "teal" });
  });
});
