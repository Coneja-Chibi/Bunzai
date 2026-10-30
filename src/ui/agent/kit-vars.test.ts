/**
 * Kit's palette, as this window receives it.
 *
 * The point of these is not that a particular colour is a particular hex. It is that there is ONE
 * palette: the window projects src/kit/render/theme.ts rather than keeping a copy of it, so a colour
 * refined in the terminal cannot silently stop matching here. This repository has already shipped
 * the other arrangement once, as two damage-reason unions that printed `undefined` on 123 files.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { kindColor, theme, verbColor } from "../../kit/render/theme";
import { LINE_NAMES, parsePalette, SURFACE_NAMES, TEXT_NAMES, type ThemePalette } from "../../extensions/theme-appearance";
import { accentRole, floorsOf } from "../_shared/accent-role";
import { contrastRatio } from "../_shared/color-math";
import { LINE_PROPS, surfaceProp, textProp } from "../shell/theme-tokens";
import { kitVars, verbOf } from "./kit-vars";

describe("kitVars", () => {
  test("EVERY COLOUR KIT HAS ARRIVES, none invented here", () => {
    const vars = kitVars() as unknown as Record<string, string>;
    for (const [name, value] of Object.entries(theme)) {
      const key = `--kit-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(vars[key]).toBe(value);
    }
  });

  test("camelCase becomes the kebab-case a custom property needs", () => {
    // `roseDeep` in TypeScript is `--kit-rose-deep` in CSS; getting this wrong produces a variable
    // that resolves to nothing, and an unset custom property paints as transparent rather than
    // failing - a border that quietly disappears with no error.
    const vars = kitVars() as unknown as Record<string, string>;
    expect(vars["--kit-rose-deep"]).toBe(theme.roseDeep);
    expect(vars["--kit-teal-deep"]).toBe(theme.tealDeep);
    expect(vars["--kit-stamp-dim"]).toBe(theme.stampDim);
  });

  test("the verb palette comes too, because it is what carries risk", () => {
    // A tool row's spine is coloured by its verb: cool reads, warm writes, red destroys. Without
    // these the transcript is a flat list where deleting looks exactly like listing.
    const vars = kitVars() as unknown as Record<string, string>;
    expect(vars["--kit-verb-delete"]).toBe(verbColor["delete"]);
    expect(vars["--kit-verb-read"]).toBe(verbColor["read"]);
  });
});

/** The bundled palettes, by theme id: Paper is the light one, the rest are dark. */
const themesDir = new URL("../../extensions/themes/", import.meta.url);
const PALETTES = Object.fromEntries(readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => [
  d.name,
  parsePalette((JSON.parse(readFileSync(new URL(`${d.name}/manifest.json`, themesDir), "utf8")) as { appearance: { palette: unknown } }).appearance.palette),
])) as Record<string, ThemePalette>;
const dashedName = (name: string): string => `--kit-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** A `var(--bk-*)` reference resolved against one palette; a hex stays itself. */
function resolve(value: string, p: ThemePalette): string {
  const ref = /^var\((--bk-[a-z-]+)\)$/.exec(value)?.[1];
  if (!ref) return value;
  for (const n of SURFACE_NAMES) if (surfaceProp(n) === ref) return p.surface[n];
  for (const n of TEXT_NAMES) if (textProp(n) === ref) return p.text[n];
  for (const n of LINE_NAMES) if (LINE_PROPS[n] === ref) return p.line[n];
  throw new Error(`unresolvable ${value}`);
}

describe("kitVars on the painted theme", () => {
  const GROUNDS = ["well", "recess", "floor", "panel", "lift", "row", "sunken", "stamp", "stampDim"] as const;
  const INKS = ["text", "bright", "soft", "quiet", "mut"] as const;
  const ACCENTS = ["rose", "teal", "gold", "violet", "alive", "red"] as const;

  test("a dark theme keeps Kit's own palette, untouched", () => {
    for (const name of ["theater", "greenroom", "stage"]) expect(kitVars(floorsOf(PALETTES[name]!))).toEqual(kitVars());
  });

  test("a light theme lays the window on the theme's own grounds and inks, so every ink reads on every ground", () => {
    const p = PALETTES["paper"]!;
    const vars = kitVars(floorsOf(p)) as unknown as Record<string, string>;
    for (const g of GROUNDS) {
      expect(vars[dashedName(g)], g).toMatch(/^var\(--bk-surface-/);
      for (const ink of INKS) expect(contrastRatio(resolve(vars[dashedName(ink)]!, p), resolve(vars[dashedName(g)]!, p)), `${ink} on ${g}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("on a light theme Kit's accents keep their hue, held to the theme's text floors", () => {
    const p = PALETTES["paper"]!, floors = floorsOf(p);
    const vars = kitVars(floors) as unknown as Record<string, string>;
    const accents: [string, string][] = [
      ...ACCENTS.map((n) => [dashedName(n), theme[n]] as [string, string]),
      ...Object.entries(verbColor).map(([v, hex]) => [`--kit-verb-${v}`, hex] as [string, string]),
      ...Object.entries(kindColor).map(([k, hex]) => [`--kit-kind-${k}`, hex] as [string, string]),
    ];
    for (const [key, hex] of accents) {
      expect(vars[key], key).toBe(accentRole(hex, floors)!.text);
      for (const s of floors.surfaces) expect(contrastRatio(vars[key]!, s), `${key} on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("on a light theme Kit's white words sit on deep fills that hold the theme's onDeep", () => {
    const p = PALETTES["paper"]!, floors = floorsOf(p);
    const vars = kitVars(floors) as unknown as Record<string, string>;
    expect(vars["--kit-white"]).toBe(`var(${textProp("onDeep")})`);
    const white = resolve(vars["--kit-white"]!, p);
    for (const deep of ["roseDeep", "tealDeep", "violetDeep"] as const) expect(contrastRatio(white, vars[dashedName(deep)]!), deep).toBeGreaterThanOrEqual(4.5);
  });
});

describe("verbOf", () => {
  test("A DESTRUCTIVE TOOL AND A READING TOOL DO NOT LOOK ALIKE", () => {
    /**
     * The single most useful thing Kit's transcript does at a glance. `studio_delete` must not be
     * the same colour as `studio_read`, because by the time somebody has read the row's words the
     * call has already happened.
     */
    expect(verbOf("studio_delete")).not.toBe(verbOf("studio_read"));
    expect(verbOf("studio_delete")).toContain("delete");
    expect(verbOf("studio_read")).toContain("read");
  });

  test("the verb is the part after the underscore, matching Kit's own reading", () => {
    expect(verbOf("studio_list")).toContain("list");
    expect(verbOf("folder_import")).toContain("import");
  });

  test("AN UNKNOWN VERB IS NEUTRAL BRIGHT, never dim and never invented", () => {
    /**
     * Kit's rule twice over: an unmapped verb falls back to a neutral BRIGHT, not to a muted grey -
     * `mut` and `line` are borders only and never carry meaning. A new tool should look plain, not
     * look broken, and certainly not accidentally look destructive.
     */
    expect(verbOf("something_unheardof")).toBe("var(--kit-bright)");
    expect(verbOf("noundersore")).toBe("var(--kit-bright)");
    expect(verbOf("")).toBe("var(--kit-bright)");
  });
});
