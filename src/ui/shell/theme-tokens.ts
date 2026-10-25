/**
 * Project a validated theme appearance onto the design-system custom properties (--bk-*, from
 * design/system/tokens). Pure: the painter in theme.ts writes the result to the root element, and
 * tokens.css aliases every legacy token (--canvas, --text, --accent...) to these names, so the palette
 * has one source. Only fixed strings and validated hex reach the map; a theme never supplies CSS text.
 */
import { accentRole, floorsOf, type AccentFloors } from "../_shared/accent-role";
import { hexToHsv, hsvToHex, normalizeHex } from "../_shared/color-math";
import { LINE_NAMES, ROLE_NAMES, ROLE_PARTS, SURFACE_NAMES, TEXT_NAMES, type RoleName, type ThemeAppearance } from "../../extensions/theme-appearance";

const FONT_STACKS = {
  archivo: '"Archivo", sans-serif', cinzel: '"Cinzel", serif', fraunces: '"Fraunces", serif',
  atkinson: '"Atkinson Hyperlegible", sans-serif', "plex-mono": '"IBM Plex Mono", monospace',
  fredoka: '"Fredoka", sans-serif', inter: '"Inter", sans-serif', "courier-prime": '"Courier Prime", "Courier New", monospace',
  "jetbrains-mono": '"JetBrains Mono", monospace',
  // apps/rc globals.css:84 (body) and Tailwind's compiled font-mono: what RoleCall renders, not what its layout comments intend
  "system-ui": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "system-mono": 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;
/** gap, inner line, hard offset shadow and resting-bracket opacity per frame style (px, never blurred). */
const FRAMES = {
  rule: [0, 0, 0, 0], double: [3, 1, 0, 0], bracket: [0, 0, 0, 1], slab: [0, 0, 4, 0], stamp: [0, 0, 6, 0],
} as const;
const DENSITY = { dense: 0.85, comfortable: 1, roomy: 1.15, airy: 1.3 } as const;
const SCALE = [1, 1.0625, 1.125] as const;
/** durations in ms: instant, fast, base, slow; the move easing; the hover lift in px. "none" is zero everywhere. */
const MOTION = {
  none: [[0, 0, 0, 0], "linear", 0], calm: [[120, 180, 300, 480], "cubic-bezier(0.45, 0, 0.55, 1)", 2],
  snappy: [[50, 80, 120, 200], "steps(2)", 2], bouncy: [[80, 140, 220, 340], "cubic-bezier(0.34, 1.56, 0.64, 1)", 2],
} as const;
export const surfaceProp = (n: (typeof SURFACE_NAMES)[number]): string => `--bk-surface-${n}`;
export const roleProp = (r: RoleName, part: (typeof ROLE_PARTS)[number]): string => `--bk-role-${r}${part === "fill" ? "" : "-" + part}`;
export const textProp = (n: (typeof TEXT_NAMES)[number]): string => "--bk-text" + (n === "text" ? "" : "-" + n.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
export const LINE_PROPS: Record<(typeof LINE_NAMES)[number], string> = { strong: "--bk-line-strong", line: "--bk-line", track: "--bk-line-track", control: "--bk-line-control", focus: "--bk-focus-color" };

/** The root properties an accent's contrast floors are read from, in AccentFloors order. */
export const FLOOR_PROPS: readonly string[] = [...SURFACE_NAMES.filter((n) => n !== "ink").map(surfaceProp), LINE_PROPS.track, textProp("text"), textProp("onTint"), textProp("onDeep")];

/** The floors painted on the root (a theme's palette, or tokens.css for core); null when any is unreadable. */
export function floorsFromStyle(style: Pick<CSSStyleDeclaration, "getPropertyValue">): AccentFloors | null {
  const v = FLOOR_PROPS.map((n) => normalizeHex(style.getPropertyValue(n)));
  if (!v.every((x) => x !== null)) return null;
  return { surfaces: v.slice(0, 6) as string[], track: v[6]!, text: v[7]!, onTint: v[8]!, onDeep: v[9]! };
}

/** How far, in degrees, action and select sit from the accent on the colour wheel: close enough to read as one family. */
const NEIGHBOUR_TURN = 28;

/**
 * The user's accent as the brand, action and select roles, each held to the given floors; empty for a value that is
 * not a colour. Brand is the accent itself; action and select are its neighbours either side, so the chrome keeps a
 * little range instead of one flat colour everywhere.
 */
export function houseAccentProperties(houseAccent: string | undefined, floors: AccentFloors): Record<string, string> {
  const hex = houseAccent ? normalizeHex(houseAccent) : null;
  const out: Record<string, string> = {};
  if (!hex) return out;
  const { h, s, v } = hexToHsv(hex);
  const sources = { brand: hex, action: hsvToHex({ h: h + NEIGHBOUR_TURN, s, v }), select: hsvToHex({ h: h - NEIGHBOUR_TURN, s, v }) };
  for (const r of ["brand", "action", "select"] as const) {
    const role = accentRole(sources[r], floors);
    if (role) { out[roleProp(r, "fill")] = role.fill; out[roleProp(r, "text")] = role.text; out[roleProp(r, "deep")] = role.deep; }
  }
  return out;
}

/** Every property themeProperties can emit: the painter clears these, and .host-protected must redeclare them all. */
export const THEME_PROPERTY_NAMES: readonly string[] = [
  ...SURFACE_NAMES.map((n) => surfaceProp(n)), ...Object.values(LINE_PROPS), ...TEXT_NAMES.map((n) => textProp(n)),
  ...ROLE_NAMES.flatMap((r) => ROLE_PARTS.map((part) => roleProp(r, part))),
  "--bk-font-display", "--bk-font-name", "--bk-font-ui", "--bk-font-body", "--bk-font-mono", "--bk-type-scale",
  "--bk-frame-w", "--bk-frame-gap", "--bk-frame-inner-w", "--bk-frame-shadow-x", "--bk-frame-shadow-y", "--bk-bracket-rest", "--bk-density",
  "--bk-dur-instant", "--bk-dur-fast", "--bk-dur-base", "--bk-dur-slow", "--bk-ease-move", "--bk-lift-y",
];

export function themeProperties(a: ThemeAppearance, houseAccent?: string): Record<string, string> {
  const { palette: p, type, shape } = a;
  const out: Record<string, string> = {};
  for (const n of SURFACE_NAMES) out[surfaceProp(n)] = p.surface[n];
  for (const n of LINE_NAMES) out[LINE_PROPS[n]] = p.line[n];
  for (const n of TEXT_NAMES) out[textProp(n)] = p.text[n];
  for (const r of ROLE_NAMES) for (const part of ROLE_PARTS) out[roleProp(r, part)] = p.roles[r][part];
  if (a.accent.follows === "user") Object.assign(out, houseAccentProperties(houseAccent, floorsOf(p)));
  out["--bk-font-display"] = out["--bk-font-name"] = FONT_STACKS[type.display]; out["--bk-font-ui"] = FONT_STACKS[type.ui]; out["--bk-font-body"] = FONT_STACKS[type.body]; out["--bk-font-mono"] = FONT_STACKS[type.mono];
  out["--bk-type-scale"] = String(SCALE[type.scale]);
  const [gap, inner, shadow, rest] = FRAMES[shape.frame];
  out["--bk-frame-w"] = `${shape.frameWidth}px`; out["--bk-frame-gap"] = `${gap}px`; out["--bk-frame-inner-w"] = `${inner}px`;
  out["--bk-frame-shadow-x"] = `${shadow}px`; out["--bk-frame-shadow-y"] = `${shadow}px`; out["--bk-bracket-rest"] = String(rest);
  out["--bk-density"] = String(DENSITY[shape.density]);
  const [[instant, fast, base, slow], ease, lift] = MOTION[shape.motion];
  out["--bk-dur-instant"] = `${instant}ms`; out["--bk-dur-fast"] = `${fast}ms`; out["--bk-dur-base"] = `${base}ms`; out["--bk-dur-slow"] = `${slow}ms`;
  out["--bk-ease-move"] = ease; out["--bk-lift-y"] = `${-lift}px`;
  return out;
}
