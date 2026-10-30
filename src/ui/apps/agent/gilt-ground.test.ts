/**
 * Under the gilt-frame panel the agent room stands on the THEME's well, not on Kit's dark floor, so
 * whatever is drawn straight on that ground (the key hints under the composer, the "What it can see"
 * summary) has to take the theme's text tokens. In Kit's own colors it vanished on a light palette:
 * near-white keys on an ivory well measured 1.04:1.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { contrastRatio } from "../../_shared/color-math";
import { parsePalette, type ThemePalette } from "../../../extensions/theme-appearance";
import { AGENT_CHIP_STYLE, AGENT_GATE_STYLE, AGENT_KIT_STYLE, AGENT_STYLE, AGENT_TALK_STYLE } from "./styles";
import { AGENT_PREMIERE_STYLE } from "./premiere-style";

const CSS = (AGENT_STYLE + AGENT_TALK_STYLE + AGENT_CHIP_STYLE + AGENT_GATE_STYLE + AGENT_KIT_STYLE + AGENT_PREMIERE_STYLE).replace(/\/\*[\s\S]*?\*\//g, "");
const GILT = 'html[data-surface-ui-panel="gilt-frame"] .agent-room';

const themesDir = new URL("../../../extensions/themes/", import.meta.url);
const PALETTES: [string, ThemePalette][] = readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => [
  d.name,
  parsePalette((JSON.parse(readFileSync(new URL(`${d.name}/manifest.json`, themesDir), "utf8")) as { appearance: { palette: unknown } }).appearance.palette),
]);

/** The last declaration of `prop` in a rule whose selector list names `selector` exactly. */
function declared(selector: string, prop: string): string | undefined {
  let found: string | undefined;
  for (const [, selectors, body] of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors!.split(",").some((s) => s.trim() === selector)) continue;
    const value = new RegExp(String.raw`(?:^|[;\s])${prop}\s*:\s*([^;]+)`).exec(body!)?.[1]?.trim();
    if (value) found = value;
  }
  return found;
}

/** The theme tokens this room may draw text in, resolved against one palette. */
const THEME_TEXT: Record<string, (p: ThemePalette) => string> = {
  "var(--text)": (p) => p.text.text, "var(--text-soft)": (p) => p.text.soft,
  "var(--text-dim)": (p) => p.text.dim, "var(--text-faint)": (p) => p.text.faint,
  "var(--bk-role-select-text)": (p) => p.roles.select.text,
  "var(--bk-role-brand-text)": (p) => p.roles.brand.text,
};

describe("agent room on the gilt-frame ground", () => {
  test("the ground is still the theme's well (the premise of every check below)", () => {
    expect(declared(GILT, "background")).toBe("var(--stage-well)");
  });

  for (const part of [".kit-hints__key", ".kit-hints__label", ".agent-room__block summary"]) {
    test(`${part} is drawn in a theme text token that reads on every bundled palette's well`, () => {
      const color = declared(`${GILT} ${part}`, "color");
      expect(color, `${part} has no gilt-frame color, so it keeps Kit's own`).toBeDefined();
      const resolve = THEME_TEXT[color!];
      expect(resolve, `${part} uses ${color}, not a theme text token`).toBeDefined();
      for (const [name, palette] of PALETTES) {
        expect(contrastRatio(resolve!(palette), palette.surface.well), `${part} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

test("docked speaker labels use readable foregrounds rather than decorative spine fills", () => {
  const root = '.agent-room[data-room="docked"]';
  expect(declared(`${root} .agent-room__who`, "color")).toBe("var(--spine-text)");
  for (const suffix of ["", "--user", "--tool"]) {
    const token = declared(`${root} .agent-room__line${suffix}`, "--spine-text") ?? declared(`${root} .agent-room__line`, "--spine-text");
    const resolve = THEME_TEXT[token ?? ""];
    expect(resolve, `${suffix} has no readable speaker foreground`).toBeDefined();
    for (const [name, palette] of PALETTES) for (const surface of ["well", "field", "sunken", "raised"] as const) {
      expect(contrastRatio(resolve!(palette), palette.surface[surface]), `${suffix} on ${name}/${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
