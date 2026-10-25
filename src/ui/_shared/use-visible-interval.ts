/**
 * A `setInterval` that stops paying for itself the moment nobody could see its result.
 *
 * TWO GATES, EITHER ONE ENOUGH TO STOP IT. The tab itself (`document.visibilityState`): a
 * minimized or backgrounded window draws nothing, so a timer ticking state nobody renders is pure
 * waste. And, given an element, whether
 * that element is currently on screen (an `IntersectionObserver`, the same gate `art-cache.ts`'s
 * `useArtSrc` and `peek-queue.ts` already use): a carousel scrolled out of view still has a tab in
 * the foreground, but nothing is watching it animate either.
 *
 * WHY NOT setTimeout(0) TRICKS OR requestAnimationFrame. Those still run every frame or every tick
 * regardless of visibility; the browser itself already throttles rAF in a hidden tab, but not to
 * zero, and this app's budget is zero. A plain gated interval is the smallest correct fix.
 *
 * THE LATEST fn, NOT THE FIRST. Held in a ref like every other "activity" callback in this codebase
 * (`use-studio-changes.ts`'s `reopenRef`), so a caller's closure can read current props without the
 * effect tearing the interval down and rebuilding it every render.
 */
import { useEffect, useRef } from "react";

/**
 * `ms: null` means "nothing to tick right now" (fewer than two favorites, reduced motion, a
 * settings section that is closed): the effect arms no timer at all, rather than firing on schedule
 * into a callback that turns out to do nothing. A literal `on` boolean would say the same thing with
 * one more parameter; this says it with the value that would otherwise be meaningless.
 */
export function useVisibleInterval(fn: () => void, ms: number | null, el?: { readonly current: Element | null }): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (ms === null) return;
    // No document at all (a non-browser render target): nothing to gate on, so do nothing rather
    // than guess. Callers outside the DOM do not use this hook (see AGENTS traps: two things can
    // share a name and not share a runtime).
    if (typeof document === "undefined") return;

    let tabVisible = document.visibilityState === "visible";
    let onScreen = !el;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sync = (): void => {
      const shouldRun = tabVisible && onScreen;
      if (shouldRun && timer === null) timer = setInterval(() => fnRef.current(), ms);
      else if (!shouldRun && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = (): void => {
      tabVisible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    let observer: IntersectionObserver | undefined;
    if (el) {
      const target = el.current;
      if (target && typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            sync();
          },
          { rootMargin: "50% 50%" },
        );
        observer.observe(target);
      } else {
        // No element yet, or the test/engine has no IntersectionObserver: fail toward running
        // rather than a silently frozen animation, since visibility is still the primary gate.
        onScreen = true;
      }
    }

    sync();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer?.disconnect();
      if (timer !== null) clearInterval(timer);
    };
  }, [ms, el]);
}
