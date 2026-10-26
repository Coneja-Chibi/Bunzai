/**
 * The user's accessibility choices as values: the interface text size range and the readers for the three stored keys. Shared by
 * the Settings app and the Messenger You scope (which write them through ctx.prefs) and the shell (shell/accessibility.ts paints them).
 */
/** Interface text size in px: the control text size. The default matches the theme's 14px; meta text is held at 12px or more in CSS. */
export const UI_TEXT = { min: 12, max: 20, step: 1, def: 14 } as const;

/** A stored size read back as a whole px inside the range; anything else is the default. */
export function uiTextSizeOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return UI_TEXT.def;
  return Math.min(UI_TEXT.max, Math.max(UI_TEXT.min, Math.round(value)));
}

export const reduceMotionOf = (value: unknown): boolean => value === true;
export const highContrastOf = (value: unknown): boolean => value === true;
