/**
 * The timed feedback hooks (dry audit B5): a value that shows for a moment and clears itself ("Copied", a notice),
 * and a toast that dismisses itself a while after it appears. Each used to be a hand-written timer beside every
 * caller, and they drifted: a second flash was cleared by the first one's timer, a timer outlived its owner, and a
 * parent re-render with a new callback restarted a countdown.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** How long each kind of feedback stays up, in one place. */
export const FLASH_MS = {
  /** "Copied" and its failure. */
  copy: 1500,
  /** The agent window's one-line notice. */
  notice: 2200,
  /** A new status-bar note lifted out of the footer as a toast. */
  status: 6000,
  /** An undo or redo toast, long enough to reach for. */
  undo: 8000,
} as const;

/** A value shown for `ms` and then cleared. A newer flash replaces the last and gets its own full time; unmounting stops the clock. */
export function useFlash<T>(ms: number): { value: T | null; flash(value: T): void; clear(): void } {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback((): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setValue(null);
  }, []);
  const flash = useCallback((next: T): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; setValue(null); }, ms);
    setValue(next);
  }, [ms]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  return { value, flash, clear };
}

/**
 * Calls `dismiss` `ms` after `shown` last changed to something truthy (a toast's message or token). A new `shown`
 * restarts the clock; a new `dismiss` closure does not, because it is read at call time.
 */
export function useAutoDismiss(shown: unknown, ms: number, dismiss: () => void): void {
  const latest = useRef(dismiss);
  latest.current = dismiss;
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => latest.current(), ms);
    return () => clearTimeout(timer);
  }, [shown, ms]);
}
