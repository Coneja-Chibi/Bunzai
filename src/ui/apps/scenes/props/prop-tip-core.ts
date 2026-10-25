/**
 * Where a Props tooltip goes: RoleCall's RichTooltip resolvePosition (packages/ui/src/rich-tooltip.tsx:95-130). The tip prefers below
 * its row, then above, then right, then left, takes the first side that fits whole inside the viewport with a 12px margin and a 12px gap
 * from the row, and otherwise sits below, pulled back inside the margin. Pure, so the flip is testable without layout.
 */
export interface TipBox { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface TipPoint { x: number; y: number }

export const TIP_GAP = 12;
export const TIP_MARGIN = 12;
/** RoleCall's peek: the card is 320px wide and, before it is measured, taken to be 112px tall. */
export const TIP_WIDTH = 320;
export const TIP_HEIGHT_GUESS = 112;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function tipPosition(trigger: TipBox, tip: { width: number; height: number } | null, viewport: { width: number; height: number }): TipPoint {
  const width = tip?.width || TIP_WIDTH;
  const height = tip?.height || TIP_HEIGHT_GUESS;
  const centerX = trigger.left + trigger.width / 2 - width / 2;
  const centerY = trigger.top + trigger.height / 2 - height / 2;
  const sides: TipPoint[] = [
    { x: centerX, y: trigger.bottom + TIP_GAP },
    { x: centerX, y: trigger.top - height - TIP_GAP },
    { x: trigger.right + TIP_GAP, y: centerY },
    { x: trigger.left - width - TIP_GAP, y: centerY },
  ];
  const fits = (p: TipPoint): boolean => p.x >= TIP_MARGIN && p.y >= TIP_MARGIN && p.x + width <= viewport.width - TIP_MARGIN && p.y + height <= viewport.height - TIP_MARGIN;
  const best = sides.find(fits) ?? sides[0]!;
  return { x: clamp(best.x, TIP_MARGIN, viewport.width - width - TIP_MARGIN), y: clamp(best.y, TIP_MARGIN, viewport.height - height - TIP_MARGIN) };
}
