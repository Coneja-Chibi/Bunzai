/**
 * Touch reach for a message's action bar, as RoleCall does it (EditableMessage.tsx:1475-1500, 1992-2010;
 * useMessageActions.ts:75-90; useIsMobile.ts:12): below 1024 px (tablets count) a tap on the message
 * toggles the bar; a tap on anything that owns its own click is not a tap on the message; two toggles
 * within 100 ms are one physical tap seen twice (touch, then the synthesized click).
 */
export const TOUCH_BREAKPOINT_PX = 1024;
export const TOUCH_DEBOUNCE_MS = 100;

/** RoleCall's controls list (EditableMessage.tsx:2002-2004). */
const OWN_CLICK = 'a, button, summary, details, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [contenteditable="true"]';

export function isNarrow(innerWidth: number): boolean {
  return innerWidth < TOUCH_BREAKPOINT_PX;
}

export function tapToggles(now: number, lastToggleAt: number): boolean {
  return now - lastToggleAt >= TOUCH_DEBOUNCE_MS;
}

export function ownsItsClick(target: Element | null): boolean {
  return target !== null && target.closest(OWN_CLICK) !== null;
}
