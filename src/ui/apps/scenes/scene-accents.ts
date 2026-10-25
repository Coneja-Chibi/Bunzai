/**
 * The scene's scoped accents (RoleCall: the character's colour tints its wing, the persona's tints its wing and your lines,
 * and the scene accent, by the Stage wing's source, tints the replies and the chrome). Each piece's colour comes from the
 * scene's frozen snapshot through the one resolver (studio/summary.ts pieceAccent: authored signature, else the art accent
 * the Library card shows); the frozen cast accent backs up a snapshot with neither. A piece with no color paints nothing,
 * so the deck hue shows.
 */
import type { CSSProperties } from "react";
import { useScopedAccents } from "../../_shared/use-scoped-accents";
import { pieceAccent } from "../../../studio/summary";
import { ACCENT_CUSTOM_KEY, ACCENT_SOURCE_KEY, accentSourceOf, sceneAccentHex } from "./scene-accent-core";
import type { PieceColors } from "./scene-accent-core";
import type { OpenScene } from "../../../studio/scenes";

/** Module constants on purpose: a finished Bubble skips re-rendering only while its tone is the same object (perf R7). */
export const CHAR_TONE = { "--tone": "var(--bk-scene-accent-text,var(--bk-role-brand-text))", "--tone-fill": "var(--bk-scene-accent,var(--bk-role-brand))" } as CSSProperties;
export const USER_TONE = { "--tone": "var(--bk-persona-accent-text,var(--deck-persona))", "--tone-fill": "var(--bk-persona-accent,var(--deck-persona))" } as CSSProperties;

/** The profile source: the scene scope wears the theme's brand roles, which already carry the user's house accent. */
const HOUSE = { "--bk-scene-accent": "var(--bk-role-brand)", "--bk-scene-accent-text": "var(--bk-role-brand-text)", "--bk-scene-accent-deep": "var(--bk-role-brand-deep)" } as CSSProperties;

/** The two pieces' colours, as the scene's cast shows them (also what the Stage wing's source picker offers). */
export function sceneColors(scene: OpenScene | null): PieceColors {
  return {
    character: scene ? pieceAccent(scene.snapshot.character) ?? scene.chat.cast.character.accent : undefined,
    persona: scene?.snapshot.persona ? pieceAccent(scene.snapshot.persona) : undefined,
  };
}

export function useSceneAccents(scene: OpenScene | null, prefs: { get(key: string): unknown }): CSSProperties | undefined {
  const colors = sceneColors(scene);
  const source = accentSourceOf(prefs.get(ACCENT_SOURCE_KEY));
  const painted = useScopedAccents({ ...colors, scene: sceneAccentHex(source, colors, prefs.get(ACCENT_CUSTOM_KEY)) });
  return source === "profile" ? { ...painted, ...HOUSE } : painted;
}
