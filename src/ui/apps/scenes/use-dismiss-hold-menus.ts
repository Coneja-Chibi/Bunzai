/** Closes the scene header's open menus on Escape or a press outside the `.hold` wrapper that holds them. */
import { useEffect } from "react";
import { useEscapeKey } from "../../_shared/use-escape-key";

export function useDismissHoldMenus(open: boolean, close: () => void): void {
  useEscapeKey(close, open);
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent): void => {
      if (!(e.target instanceof Element && e.target.closest(".hold"))) close();
    };
    document.addEventListener("pointerdown", onPress);
    return () => document.removeEventListener("pointerdown", onPress);
  }, [open, close]);
}
