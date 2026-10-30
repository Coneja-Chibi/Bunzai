/**
 * Kit's palette, as CSS custom properties.
 *
 * DERIVED, NOT TRANSCRIBED. Kit's colours are locked in src/kit/render/theme.ts, and the obvious way
 * to give this window Kit's look would be to copy the hexes into a stylesheet. That is the same
 * duplicated-authority defect that put two damage-reason unions in this repo and printed `undefined`
 * on 123 files: two copies of one fact, and nothing that fails when they drift. A colour refined in
 * the terminal would silently stop matching the window, and nobody would find out from a test.
 *
 * So the palette is imported and emitted as variables at runtime. There is one palette. This file is
 * a projection of it, and it cannot fall behind.
 *
 * SCOPED TO THE PANEL, not the document. The desktop app has its own theme with its own tokens and
 * its own light mode; Kit's is a dark terminal palette and would be wrong applied globally. These
 * ride on the agent surface's root element and stop there.
 *
 * ON A LIGHT THEME THE WINDOW FOLLOWS THE THEME. A black slab in an ivory studio reads as a broken
 * page, so when the painted theme's text is darker than its well, Kit's grounds and inks become the
 * theme's own (`var(--bk-*)`, every pair the theme contract already holds) and Kit's accents keep
 * their hue, held to the theme's text floors by accentRole. A dark theme, and the protected Gate
 * card (which never passes floors), keep Kit's palette exactly.
 */
import { useMemo, type CSSProperties } from "react";
import { theme, verbColor, kindColor } from "../../kit/render/theme";
import { accentRole, type AccentFloors } from "../_shared/accent-role";
import { relativeLuminance } from "../_shared/color-math";
import { usePaintedFloors } from "../_shared/use-scoped-accents";
import { LINE_PROPS, surfaceProp, textProp } from "../shell/theme-tokens";

/** The first step of Kit rose sweep ramp: the rule where the beam is not. */
const SWEEP_DIM = "#140409"; // hardcode-ok: one entry of Kit own sweep ramp, mirrored from sweep-line.ts

/** camelCase to the kebab-case a custom property wants. */
const dashed = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * Kit's grounds and inks, by the role each plays, mapped onto the theme's own on a light theme. The
 * bands keep their order of tone: the ground is the theme's well, replies rest on sunken, your line
 * lifts to the field. `mut` is a border in Kit's book but a few hint labels wear it, so it takes faint
 * (held to text floors) rather than a line color.
 */
const LIGHT: Partial<Record<keyof typeof theme, string>> = {
  well: `var(${surfaceProp("well")})`, recess: `var(${surfaceProp("sunken")})`, floor: `var(${surfaceProp("base")})`,
  panel: `var(${surfaceProp("panel")})`, lift: `var(${surfaceProp("field")})`, row: `var(${surfaceProp("raised")})`,
  sunken: `var(${surfaceProp("sunken")})`, stamp: `var(${surfaceProp("raised")})`, stampDim: `var(${surfaceProp("sunken")})`,
  edge: `var(${LINE_PROPS.strong})`, seam: `var(${LINE_PROPS.track})`, line: `var(${LINE_PROPS.control})`, div: `var(${LINE_PROPS.line})`,
  text: `var(${textProp("text")})`, bright: `var(${textProp("text")})`, soft: `var(${textProp("soft")})`,
  quiet: `var(${textProp("dim")})`, mut: `var(${textProp("faint")})`, white: `var(${textProp("onDeep")})`,
};
/** Kit's deep tones are fills that carry white words; on a light theme they hold the theme's onDeep. */
const DEEP: ReadonlySet<string> = new Set(["roseDeep", "tealDeep", "violetDeep", "goldDim"]);

/** A light theme draws dark text on its well. */
export const isLightKit = (f: AccentFloors): boolean => relativeLuminance(f.text) < relativeLuminance(f.surfaces[0]!);

/** One Kit accent on a light theme: its own hue, nudged until it reads (text) or carries onDeep (deep). */
const held = (hex: string, f: AccentFloors, deep: boolean): string => {
  const role = accentRole(hex, f);
  return (deep ? role?.deep : role?.text) ?? hex;
};

/**
 * Every colour Kit has, prefixed so nothing collides with the studio's own tokens.
 *
 * The verb and kind palettes come too. They are what let a tool row's spine say what KIND of thing
 * is about to happen - cool for reads, warm for writes, red for destructive - which is the part of
 * Kit's transcript that carries risk at a glance, and the part a plain chat log throws away.
 *
 * `floors` are the painted theme's (usePaintedFloors); without them, or on a dark theme, the palette
 * is Kit's own.
 */
export function kitVars(floors?: AccentFloors | null): CSSProperties {
  const light = floors && isLightKit(floors) ? floors : null;
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme) as [keyof typeof theme, string][]) {
    vars[`--kit-${dashed(name)}`] = !light ? value : LIGHT[name] ?? held(value, light, DEEP.has(name));
  }
  for (const [verb, value] of Object.entries(verbColor)) vars[`--kit-verb-${verb}`] = light ? held(value, light, false) : value;
  for (const [kind, value] of Object.entries(kindColor)) vars[`--kit-kind-${kind}`] = light ? held(value, light, false) : value;
  /**
   * The dim head of Kit sweep ramp, which is the colour of the UNLIT rule. It is a ramp entry
   * rather than a theme colour, so it is named here instead of being invented in CSS. On a light
   * theme the unlit rule is the theme's track line.
   */
  vars["--kit-sweep-dim"] = light ? `var(${LINE_PROPS.track})` : SWEEP_DIM;
  return vars as CSSProperties;
}

/** kitVars for the theme painted right now: a component's root wears this, and a theme switch re-derives. */
export function useKitVars(): CSSProperties {
  const floors = usePaintedFloors();
  return useMemo(() => kitVars(floors), [floors]);
}

/**
 * The colour a tool's spine takes, by the verb in its name.
 *
 * Kit reads the verb off the tool name (`studio_read` reads, `studio_delete` destroys) and colours
 * the row's spine from it. Doing the same here means a window transcript and a terminal transcript
 * agree about what a given call looked like, which matters when somebody is comparing the two to
 * work out what happened.
 */
export function verbOf(toolName: string): string {
  const verb = toolName.includes("_") ? (toolName.split("_")[1] ?? "") : toolName;
  // The known verbs become their own variable; anything else falls back to Kit's neutral bright.
  return verb && verb in verbColor ? `var(--kit-verb-${verb})` : "var(--kit-bright)";
}
