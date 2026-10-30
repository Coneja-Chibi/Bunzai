/**
 * The booth's marquee (the strip naming the slot above the portrait) stands on `--stage-black`, which
 * is the palette's `surface.ink`. On a light palette ink is light, so the marquee's words must be a
 * color the theme contract holds against ink (`text`, 4.5:1), not `onDeep`, which is only ever held
 * against the deep role fills: white on an ivory ink measured 1.33:1. The piece name beside it is drawn
 * in the piece's accent, held to the theme's text floors (`--a-text`).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { accentRole, floorsOf } from "../../_shared/accent-role";
import { contrastRatio } from "../../_shared/color-math";
import { parsePalette, type ThemePalette } from "../../../extensions/theme-appearance";

const css = readFileSync(new URL("./styles.module.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const themesDir = new URL("../../../extensions/themes/", import.meta.url);
const PALETTES: [string, ThemePalette][] = readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => [
  d.name,
  parsePalette((JSON.parse(readFileSync(new URL(`${d.name}/manifest.json`, themesDir), "utf8")) as { appearance: { palette: unknown } }).appearance.palette),
]);

/** A declaration in the bare `.<cls> {` rule (not the per-frame overrides). */
function declared(cls: string, prop: string): string | undefined {
  const body = new RegExp(String.raw`(?:^|\})\s*\.${cls}\s*\{([^}]*)\}`).exec(css)?.[1];
  return body ? new RegExp(String.raw`(?:^|[;\s])${prop}\s*:\s*([^;]+);`).exec(body)?.[1]?.trim() : undefined;
}

/** The stage tokens the marquee may use, resolved against one palette (tokens.css aliases). */
const STAGE: Record<string, (p: ThemePalette) => string> = {
  "var(--stage-black)": (p) => p.surface.ink, "var(--stage-card)": (p) => p.text.text, "var(--stage-white)": (p) => p.text.onDeep,
};

describe("ticket-window marquee", () => {
  test("the marquee ground is ink (the premise of the checks below)", () => {
    expect(declared("marquee", "background")).toBe("var(--stage-black)");
  });

  test("the slot name reads on ink under every bundled palette, the light ones included", () => {
    const color = declared("marquee", "color")!;
    expect(STAGE[color], `${color} is not a stage token this test can resolve`).toBeDefined();
    for (const [name, p] of PALETTES) expect(contrastRatio(STAGE[color]!(p), p.surface.ink), name).toBeGreaterThanOrEqual(4.5);
  });

  test("the piece name wears the text-held accent, falling back to the slot name's own color", () => {
    expect(declared("marqueeTitle", "color")).toBe("var(--a-text, var(--stage-card))");
    for (const [name, p] of PALETTES) {
      const text = accentRole("#c8305a", floorsOf(p))!.text;
      expect(contrastRatio(text, p.surface.ink), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
