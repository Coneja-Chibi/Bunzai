/**
 * The one place a user-picked color becomes an accent: its fill, its text color and its deep (text-bearing fill) tone,
 * each nudged in lightness only, and only as far as the active theme's contrast floors need (the same floors
 * paletteContrastFailures holds a palette to). A color that already clears them comes back as it was; no color is
 * ever refused. The house accent (theme-tokens.ts) and the scoped character and persona accents below both come
 * from accentRole, so there is one derivation.
 */
import type { ThemePalette } from "../../extensions/theme-appearance";
import { SURFACE_NAMES } from "../../extensions/theme-appearance";
import { contrastRatio, deepAccent, hexToHsv, hsvToHex, normalizeHex } from "./color-math";

/** What an accent has to stay legible against: the six surfaces text sits on, the track line, and the two inks. */
export interface AccentFloors { surfaces: readonly string[]; track: string; text: string; onTint: string; onDeep: string }
export interface AccentRole { fill: string; text: string; deep: string }

export const floorsOf = (p: ThemePalette): AccentFloors => ({
  surfaces: SURFACE_NAMES.filter((n) => n !== "ink").map((n) => p.surface[n]), track: p.line.track,
  text: p.text.text, onTint: p.text.onTint, onDeep: p.text.onDeep,
});

const hslOf = (hex: string): { h: number; s: number; l: number } => {
  const { h, s, v } = hexToHsv(hex), l = v * (1 - s / 2);
  return { h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
};
const fromHsl = (h: number, s: number, l: number): string => {
  const v = l + s * Math.min(l, 1 - l);
  return hsvToHex({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v });
};
/** The nearest lightness (either way, 0.5 percent steps) at which `ok` holds; the color itself when it already does. */
function nudge(hex: string, ok: (c: string) => boolean): string | null {
  if (ok(hex)) return hex;
  const { h, s, l } = hslOf(hex);
  for (let i = 1; i <= 200; i++) for (const to of [l - i / 200, l + i / 200]) if (to >= 0 && to <= 1 && ok(fromHsl(h, s, to))) return fromHsl(h, s, to);
  return null;
}

/** Null for anything that is not a hex color, so the caller keeps its own fallback. */
export function accentRole(input: string, f: AccentFloors): AccentRole | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  const fill = nudge(hex, (c) => contrastRatio(f.onTint, c) >= 4.5) ?? hex;
  const text = nudge(hex, (c) => f.surfaces.every((s) => contrastRatio(c, s) >= 4.5) && contrastRatio(c, f.track) >= 3) ?? f.text;
  const rough = deepAccent(fill);
  return { fill, text, deep: nudge(rough, (c) => contrastRatio(f.onDeep, c) >= 4.5) ?? rough };
}

/** The scopes a container paints: the scene's character and its persona, and the scene accent (the character's, the persona's, the house's or a custom one, by the scene's accent source). */
export const ACCENT_SCOPES = ["character", "persona", "scene"] as const;
export type AccentScope = (typeof ACCENT_SCOPES)[number];
export const scopedAccentProp = (scope: AccentScope, part: "fill" | "text" | "deep"): string => `--bk-${scope}-accent${part === "fill" ? "" : "-" + part}`;
/** Every scoped name: .host-protected resets them, and the theme painter never writes one on the root. */
export const SCOPED_ACCENT_PROPERTY_NAMES: readonly string[] = ACCENT_SCOPES.flatMap((s) => (["fill", "text", "deep"] as const).map((p) => scopedAccentProp(s, p)));

/** The custom properties one scope's container paints; none when the piece has no color, so CSS falls back to the deck hue. */
export function scopedAccentProps(scope: AccentScope, hex: string | null | undefined, f: AccentFloors): Record<string, string> {
  const role = hex ? accentRole(hex, f) : null;
  return role ? { [scopedAccentProp(scope, "fill")]: role.fill, [scopedAccentProp(scope, "text")]: role.text, [scopedAccentProp(scope, "deep")]: role.deep } : {};
}
