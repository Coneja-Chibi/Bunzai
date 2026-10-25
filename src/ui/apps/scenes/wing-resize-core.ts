/**
 * Every wing's width (RoleCall `stores/wing-panel-sizes.ts`, `WingPanelContainer.tsx`, `getLeftPanelWidth`/`getRightPanelWidth` in the scene page): the width a wing opens at, the
 * bounds a drag stays inside (360 up to the least of 1600 and the scene less 80), a key step, and what the viewer left it at read fail-closed. The width is the viewer's own, so it is a
 * per-viewer pref per wing id (`ctx.prefs`), never part of a scene. RoleCall keys the same map by wing id and writes it once, when the pointer lifts.
 */
export const MIN_WIDTH = 360;
export const MAX_WIDTH = 1600;
/** RoleCall keeps this much of the viewport for the chat: `Math.min(WING_PANEL_MAX_WIDTH, window.innerWidth - 80)`. */
export const CHAT_MARGIN = 80;
export const STEP = 24;

export const widthKey = (wingId: string): string => `scene.wingWidth.${wingId}`;

/** A width in whole pixels between the least and the room the scene has (0 when the scene has not been measured: the top is 1600). */
export function clampWidth(px: number, available: number): number {
  const top = available > 0 ? Math.min(MAX_WIDTH, available - CHAT_MARGIN) : MAX_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(top, Math.round(px)));
}

/** A saved width, or `fallback` for anything that is not a finite number in range. */
export function parseWidth(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= MIN_WIDTH && raw <= MAX_WIDTH ? Math.round(raw) : fallback;
}
