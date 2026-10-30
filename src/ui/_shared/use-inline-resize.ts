/** Refit a measured element when its inline width changes, without feeding height changes back into ResizeObserver. */
import { useEffect, type RefObject } from "react";

export function useInlineResize<T extends HTMLElement>(ref: RefObject<T | null>, fit: (element: T) => void, on = true): void {
  useEffect(() => {
    const element = ref.current;
    if (!on || !element || typeof ResizeObserver === "undefined") return;
    let width = -1;
    let frame = 0;
    const watch = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next === width) return;
      width = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fit(element));
    });
    watch.observe(element);
    return () => { cancelAnimationFrame(frame); watch.disconnect(); };
  }, [ref, fit, on]);
}
