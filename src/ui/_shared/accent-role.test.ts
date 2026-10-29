/** accentRole: one derivation, held to the very floors a theme palette is. Every built-in theme and the Encore example, extreme colors included. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { paletteContrastFailures, parsePalette, type ThemePalette } from "../../extensions/theme-appearance";
import { accentRole, floorsOf, SCOPED_ACCENT_PROPERTY_NAMES, scopedAccentProp, scopedAccentProps } from "./accent-role";
import { contrastRatio, hexToHsv } from "./color-math";

const manifest = (path: string): ThemePalette => parsePalette((JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { appearance: { palette: unknown } }).appearance.palette);
const THEMES: Record<string, ThemePalette> = {
  greenroom: manifest("../../extensions/themes/greenroom/manifest.json"), theater: manifest("../../extensions/themes/theater/manifest.json"),
  paper: manifest("../../extensions/themes/paper/manifest.json"), girliepop: manifest("../../extensions/themes/stage/manifest.json"),
  encore: manifest("../../extensions/examples/bunzai.theme.encore/manifest.json"),
};
const COLORS = { white: "#ffffff", black: "#000000", neon: "#39ff14", magenta: "#ff00ff", teal: "#008080", pink: "#ff69b4", grey: "#777777", navy: "#0a0a40", cream: "#fffdd0" };

/** The derived trio in a role slot: the palette's own checker is the oracle, so these floors cannot drift from a theme's. */
const withRole = (p: ThemePalette, role: { fill: string; text: string; deep: string }): ThemePalette => ({ ...p, roles: { ...p.roles, brand: role } });

describe("accentRole against every theme", () => {
  for (const [theme, palette] of Object.entries(THEMES)) {
    for (const [name, hex] of Object.entries(COLORS)) {
      test(`${theme}: ${name} clears every role floor`, () => {
        const role = accentRole(hex, floorsOf(palette))!;
        expect(paletteContrastFailures(withRole(palette, role))).toEqual([]);
      });
    }
  }
  test("each theme's own brand role is untouched by the derivation: it already clears, so it comes back as it was", () => {
    for (const palette of Object.values(THEMES)) {
      const brand = palette.roles.brand;
      expect(accentRole(brand.text, floorsOf(palette))!.text).toBe(brand.text);
    }
  });
});

describe("accentRole keeps the person's color", () => {
  test("a color that already reads is returned byte for byte", () => {
    const f = floorsOf(THEMES.greenroom!);
    expect(accentRole("#14B8A6", f)!.text).toBe("#14b8a6");
    expect(accentRole("#fb7185", f)!.fill).toBe("#fb7185");
  });
  test("only lightness moves: the hue holds and the move is as small as the floor allows", () => {
    for (const palette of Object.values(THEMES)) {
      const f = floorsOf(palette);
      for (const hex of [COLORS.neon, COLORS.magenta, COLORS.teal, COLORS.pink, COLORS.navy]) {
        const role = accentRole(hex, f)!;
        for (const part of [role.fill, role.text]) if (part !== hex) {
          const a = hexToHsv(hex).h, b = hexToHsv(part).h;
          expect(Math.min(Math.abs(a - b), 360 - Math.abs(a - b))).toBeLessThan(6);
        }
        if (role.text !== hex) {
          const need = (c: string): boolean => f.surfaces.every((s) => contrastRatio(c, s) >= 4.5) && contrastRatio(c, f.track) >= 3;
          expect(need(role.text)).toBe(true);
          expect(need(hex)).toBe(false);
        }
      }
    }
  });
  test("white on a dark theme keeps its fill, and black on a light one is darkened only where text needs it", () => {
    expect(accentRole(COLORS.white, floorsOf(THEMES.greenroom!))!.fill).toBe("#ffffff");
    expect(accentRole(COLORS.black, floorsOf(THEMES.greenroom!))!.text).not.toBe("#000000");
    expect(accentRole(COLORS.black, floorsOf(THEMES.paper!))!.text).toBe("#000000");
  });
  test("garbage is not a color: null, so the caller keeps its fallback", () => {
    expect(accentRole("teal", floorsOf(THEMES.greenroom!))).toBeNull();
    expect(accentRole("", floorsOf(THEMES.greenroom!))).toBeNull();
  });
});

describe("scoped properties", () => {
  const f = floorsOf(THEMES.greenroom!);
  test("a piece with no color, or a bad one, paints nothing so the deck hue shows", () => {
    expect(scopedAccentProps("character", undefined, f)).toEqual({});
    expect(scopedAccentProps("persona", null, f)).toEqual({});
    expect(scopedAccentProps("persona", "not a color", f)).toEqual({});
  });
  test("one scope paints its own three properties and never the other's", () => {
    const props = scopedAccentProps("character", "#008080", f);
    expect(Object.keys(props).sort()).toEqual(["--bk-character-accent", "--bk-character-accent-deep", "--bk-character-accent-text"]);
    expect(Object.keys(scopedAccentProps("persona", "#ff69b4", f))).toEqual(["--bk-persona-accent", "--bk-persona-accent-text", "--bk-persona-accent-deep"]);
    expect(SCOPED_ACCENT_PROPERTY_NAMES).toHaveLength(9);
    expect(scopedAccentProp("persona", "fill")).toBe("--bk-persona-accent");
  });
});
