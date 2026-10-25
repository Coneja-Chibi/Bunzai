/** tokens.css contract: one palette source (the --bk-* names), every legacy token aliased, nothing rounded, the protected layer closed. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { paletteContrastFailures, LINE_NAMES, ROLE_NAMES, ROLE_PARTS, SURFACE_NAMES, TEXT_NAMES, type ThemePalette } from "../../extensions/theme-appearance";
import { LINE_PROPS, roleProp, surfaceProp, textProp, THEME_PROPERTY_NAMES } from "../shell/theme-tokens";
import { SCOPED_ACCENT_PROPERTY_NAMES } from "../_shared/accent-role";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const block = (opener: string): string => {
  const start = css.indexOf(opener);
  expect(start, opener).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("\n}", start));
};
/** The neutral core palette and fixed values, declared once on the page root. */
const core = block(":root {");
/** The alias list: ONE declaration list applied to the page AND the protected layer, so each resolves per element. */
const shared = block(":root, .host-protected {");
/** The host-only redeclaration of every property a theme can write. */
const hostBlock = block("@layer protected {") + block("\n.host-protected {");
const declared = (text: string, name: string): string | undefined => new RegExp(String.raw`(?:^|[\s;{])${name}\s*:\s*([^;]+);`).exec(text)?.[1]?.trim();
const declaredNames = (text: string): Set<string> => new Set([...text.matchAll(/(?:^|[\s;{])(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));

/** Every token the four removed palette blocks used to hard-set. Each must now alias the palette (or be listed as static). */
const FORMER_THEME_TOKENS = ("--accent --accent-deep --action-primary --action-primary-fg --canvas --chrome --chrome-structure --control-boundary --danger --danger-fg " +
  "--disabled-bg --disabled-fg --edge --face --focus-ring --ghost --ink --link --muted --overlay --panel --paper --paper-2 --prop-hare --q-stage --q-stage-deck --rose --rose-deep " +
  "--scrim --seam --selection --selection-fg --shadow-ink --shadow-ink-deep --shell-panel --shell-panel-2 --stage --stage-2 --stage-black --stage-card --stage-danger-bg " +
  "--stage-danger-deep --stage-danger-edge --stage-danger-hot --stage-danger-text --stage-deck --stage-dim --stage-faint --stage-floor --stage-ink --stage-kicker --stage-line " +
  "--stage-link --stage-macro --stage-mute --stage-ok --stage-ok-bg --stage-panel --stage-paper --stage-rose-well --stage-row --stage-seam --stage-soft --stage-sunken " +
  "--stage-text-dim --stage-var --stage-warn --stage-warn-ink --stage-well --stage-white --stamp-bg --stamp-fg --status-bg --status-dim --status-fg --success --success-fg " +
  "--text --text-dim --text-faint --text-soft --tooth --warning --warning-fg").split(" ");

describe("tokens.css", () => {
  test("no theme palette block survives: the palette is the painter's --bk-* write set over a core fallback", () => {
    expect(css).not.toMatch(/data-theme-(palette|fonts|controls|navigation|book)/);
    expect(css).not.toMatch(/:root\[data-theme/);
  });

  test("every token a theme used to hard-set is an alias of the palette, so a theme cannot be bypassed by a stale literal", () => {
    for (const name of FORMER_THEME_TOKENS) {
      const value = declared(shared, name);
      expect(value, name).toBeDefined();
      expect(value, name).toMatch(/var\(--(bk|stage|edge)-|color-mix\(|var\(--(rose|edge|stage-black)/);
    }
  });

  test("every --bk-* the aliases read is declared in the core fallback or derived in the shared block", () => {
    const known = new Set([...declaredNames(core), ...declaredNames(shared)]);
    for (const [, name] of css.matchAll(/var\((--bk-[a-z-]+)/g)) expect(known.has(name!), name).toBe(true);
  });

  test("the core palette passes the contrast floors every theme must meet", () => {
    const value = (name: string): string => declared(core, name)!;
    const palette: ThemePalette = {
      surface: Object.fromEntries(SURFACE_NAMES.map((n) => [n, value(surfaceProp(n))])) as ThemePalette["surface"],
      line: Object.fromEntries(LINE_NAMES.map((n) => [n, value(LINE_PROPS[n])])) as ThemePalette["line"],
      text: Object.fromEntries(TEXT_NAMES.map((n) => [n, value(textProp(n))])) as ThemePalette["text"],
      roles: Object.fromEntries(ROLE_NAMES.map((r) => [r, Object.fromEntries(ROLE_PARTS.map((part) => [part, value(roleProp(r, part))]))])) as ThemePalette["roles"],
    };
    expect(paletteContrastFailures(palette)).toEqual([]);
  });

  test("the protected layer re-resolves the aliases against host values: it redeclares every property the painter writes, and every --bk-* the alias list reads", () => {
    // A var() alias resolves on the element that declares it and children inherit the RESULT, so the protected layer
    // must be a subject of the alias list itself, not only redeclare the --bk-* names.
    expect(css).toContain(":root, .host-protected {");
    const hostNames = declaredNames(hostBlock);
    for (const name of THEME_PROPERTY_NAMES) expect(hostNames.has(name), name).toBe(true);
    for (const name of THEME_PROPERTY_NAMES) expect(declared(hostBlock, name), name).not.toMatch(/var\(--bk-/);
    const derived = declaredNames(shared);
    for (const [, name] of shared.matchAll(/var\((--bk-[a-z-]+)/g)) expect(hostNames.has(name!) || derived.has(name!), `${name} leaks a theme value into .host-protected`).toBe(true);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*:root, \.host-protected \{/);
  });

  test("corners are square: a radius is 0 or 50% (status dots), never a rounded rule", () => {
    for (const [, value] of css.matchAll(/border-radius\s*:\s*([^;}]+)/g)) expect(value!.trim()).toMatch(/^(0|0px|50%)$/);
  });
});

describe("RoleCall chrome tokens (plan 19)", () => {
  const house = block(":root {\n  --rc-text-micro");
  const rolecall = block(':root[data-chrome="rolecall"] {');
  const rcNames = (text: string): string[] => [...declaredNames(text)].filter((n) => n.startsWith("--rc-"));

  test("every --rc-* the RoleCall block sets also has a house default, so a bunraku theme resolves each to its own value", () => {
    expect(rcNames(rolecall).length).toBeGreaterThan(20);
    for (const name of rcNames(rolecall)) expect(declared(house, name), name).toBeDefined();
  });

  test("house corners are square; RoleCall's rounded-sm and rounded-md are 0 (its NEOBRUT override), a bare rounded is 4px", () => {
    for (const name of rcNames(house).filter((n) => n.startsWith("--rc-radius"))) expect(declared(house, name), name).toBe("0");
    expect(declared(rolecall, "--rc-radius-sm")).toBe("0");
    expect(declared(rolecall, "--rc-radius-md")).toBe("0");
    expect(declared(rolecall, "--rc-radius")).toBe("4px");
    expect(declared(rolecall, "--rc-radius-full")).toBe("9999px");
    expect(declared(rolecall, "--rc-font-inter")).toContain('"Inter"');
    expect(declared(house, "--rc-font-inter")).toBe("var(--bk-font-body)");
  });

  test("house text tokens alias the house sizes, so the 12px floor holds outside RoleCall's skin", () => {
    for (const name of rcNames(house).filter((n) => n.startsWith("--rc-text"))) expect(declared(house, name), name).toMatch(/^var\(--text-(meta|control)\)$/);
    expect(declared(rolecall, "--rc-text-micro")).toBe("0.66rem");
    expect(declared(rolecall, "--rc-text-wing")).toBe("0.82rem");
  });

  test("the surface and sampler tokens exist in both blocks, as RoleCall's compiled values under the skin", () => {
    for (const name of ["--rc-tip", "--rc-tip-detail", "--rc-hero-from", "--rc-canvas", "--rc-violet-500", ...["temp", "topp", "topk", "response", "context", "penalty"].map((k) => "--rc-sampler-" + k)]) {
      expect(declared(house, name), name).toMatch(/^var\(--bk-/);
      expect(declared(rolecall, name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(declared(rolecall, "--rc-tip")).toBe("#1c1a22");
    expect(declared(rolecall, "--rc-sampler-temp")).toBe("#ff8b1a");
  });

  test("the RoleCall skin is dark and the zinc steps are Tailwind v4's compiled values", () => {
    expect(declared(rolecall, "color-scheme")).toBe("dark");
    expect(declared(rolecall, "--rc-zinc-400")).toBe("#9f9fa9");
    expect(declared(rolecall, "--rc-zinc-950")).toBe("#09090b");
  });

  test("the UI font is a painted property, and --font-big reads it", () => {
    expect(THEME_PROPERTY_NAMES).toContain("--bk-font-ui");
    expect(declared(shared, "--font-big")).toBe("var(--font-ui)");
    expect(declared(shared, "--font-ui")).toMatch(/^var\(--bk-font-ui\)/);
  });
});

describe("protected layer cascade", () => {
  test("every token the painter writes is redeclared !important inside @layer protected, except motion, which the reduced-motion rule owns", () => {
    const layer = block("@layer protected {");
    const motion = new Set(["--bk-dur-instant", "--bk-dur-fast", "--bk-dur-base", "--bk-dur-slow", "--bk-ease-move", "--bk-lift-y"]);
    for (const name of THEME_PROPERTY_NAMES.filter((n) => !motion.has(n))) expect(declared(layer, name), name).toMatch(/!important$/);
    for (const name of motion) expect(declared(layer, name), name).toBeUndefined();
    expect(layer).toMatch(/visibility:\s*visible !important/);
    expect(layer).toMatch(/pointer-events:\s*auto !important/);
  });
});

describe("scoped accents and the protected layer", () => {
  test("a piece's scoped accent is reset to nothing inside @layer protected, so no protected surface can wear a character's or persona's color", () => {
    const layer = block("@layer protected {");
    for (const name of SCOPED_ACCENT_PROPERTY_NAMES) expect(declared(layer, name), name).toBe("initial !important");
  });

  test("the theme painter's write set never names a scoped property", () => {
    for (const name of SCOPED_ACCENT_PROPERTY_NAMES) expect(THEME_PROPERTY_NAMES, name).not.toContain(name);
  });
});
