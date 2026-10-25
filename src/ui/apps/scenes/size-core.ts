/**
 * The sizes a viewer drags in the Prompting wing (RoleCall's PresetPanel.tsx:184-195, one px value each, saved per device): the prompt list's width
 * (160 to 520, opens at 220) and the macro preview's height (80 to 640, opens at 160). Each is the viewer's own and nothing else's, so it is a per-viewer
 * pref (`ctx.prefs`), read fail-closed. Pure.
 */
export interface SizeRule { key: string; min: number; max: number; start: number; step: number }

export const LIST_WIDTH: SizeRule = { key: "prompting.listWidth", min: 160, max: 520, start: 220, step: 16 };
export const PREVIEW_HEIGHT: SizeRule = { key: "prompting.previewHeight", min: 80, max: 640, start: 160, step: 16 };

/** A size in whole pixels, held between the rule's least and most. */
export const clampSize = (rule: SizeRule, px: number): number => Math.min(rule.max, Math.max(rule.min, Math.round(px)));

/** A saved size, or the rule's start for anything that is not a finite number in range. */
export const parseSize = (rule: SizeRule, raw: unknown): number =>
  typeof raw === "number" && Number.isFinite(raw) && raw >= rule.min && raw <= rule.max ? Math.round(raw) : rule.start;
