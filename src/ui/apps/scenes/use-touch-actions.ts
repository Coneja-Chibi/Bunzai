/** One bubble's tap-to-reveal for its action bar (touch-actions-core.ts). The state is the bubble's own. */
import { useCallback, useRef, useState, type MouseEvent } from "react";
import { isNarrow, ownsItsClick, tapToggles } from "./touch-actions-core";

export function useTouchActions(): [boolean, (e: MouseEvent) => void] {
  const [open, setOpen] = useState(false);
  const last = useRef(0);
  const onTap = useCallback((e: MouseEvent): void => {
    if (!isNarrow(window.innerWidth) || ownsItsClick(e.target as Element | null)) return;
    const now = Date.now();
    if (!tapToggles(now, last.current)) return;
    last.current = now;
    setOpen((v) => !v);
  }, []);
  return [open, onTap];
}
