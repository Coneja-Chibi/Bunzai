/**
 * The scene accent source (RoleCall's stageSettings.accentColorSource, page.tsx:2887-2910): which colour the replies and
 * the scene chrome wear. Character is the default; persona, profile (the user's house accent) and a custom colour are the
 * others. RoleCall's preset source is left out: no Bunzai preset stores an accent. A source is available when it HAS a
 * colour (RoleCall hid a source whose colour equalled a sentinel hex), and a missing colour paints nothing, so the theme shows.
 */
import { normalizeHex } from "../../_shared/color-math";

export const ACCENT_SOURCE_KEY = "scenes.accentSource";
export const ACCENT_CUSTOM_KEY = "scenes.accentCustom";
export const ACCENT_SOURCES = ["character", "persona", "profile", "custom"] as const;
export type AccentSource = (typeof ACCENT_SOURCES)[number];

export interface PieceColors { character?: string; persona?: string }

export const accentSourceOf = (pref: unknown): AccentSource => ACCENT_SOURCES.find((s) => s === pref) ?? "character";

/** The hex the scene scope wears; undefined for profile (the theme's brand roles) and for a source with no colour. */
export function sceneAccentHex(source: AccentSource, colors: PieceColors, custom: unknown): string | undefined {
  if (source === "persona") return colors.persona;
  if (source === "custom") return typeof custom === "string" ? normalizeHex(custom) ?? undefined : undefined;
  return source === "profile" ? undefined : colors.character;
}

export const accentSourceAvailable = (source: AccentSource, colors: PieceColors): boolean =>
  source === "character" ? !!colors.character : source === "persona" ? !!colors.persona : true;
