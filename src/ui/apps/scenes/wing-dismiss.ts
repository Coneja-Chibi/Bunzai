/**
 * How a wing is put away in the default theme (RoleCall `WingPanelContainer.tsx` pointerdown listener): opening a wing pushes the chat aside instead of pausing it, and a press anywhere
 * outside the panel closes it. The rail, a dialog layered over the scene, a pop-out, and anything portaled outside the scene own their own presses. Other themes keep the pause and the
 * Scene Paused mark (their wings variants lay a panel over the scene), so the listener is only on for the default theme.
 */
import { useEffect, useRef, type RefObject } from "react";

/** Whether this theme lays wings beside the chat (the RoleCall chrome, the default theme) rather than over it. */
export const pushesAside = (): boolean => typeof document !== "undefined" && document.documentElement.dataset["chrome"] === "rolecall";

const OWN_PRESS = '[data-wing-panel],[data-wing-panel-ignore-outside],[data-part="scene.wings"],[data-part="scene.popout"],[role="dialog"][aria-modal="true"]';

/** Whether a press belongs to something other than the scene's chat: the wing itself, its rail, a dialog, or a portal outside `root`. */
export function isOwnPress(e: Pick<Event, "target" | "composedPath">, root: Element | null): boolean {
  if (e.composedPath().some((t) => t instanceof Element && t.closest(OWN_PRESS))) return true;
  return !(e.target instanceof Node && root?.contains(e.target));
}

/** While a wing is open in the default theme, a press outside it calls `onClose`. */
export function useWingDismiss(open: boolean, root: RefObject<Element | null>, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !pushesAside()) return undefined;
    const press = (e: PointerEvent): void => { if (!isOwnPress(e, root.current)) close.current(); };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [open, root]);
}
