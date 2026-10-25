/**
 * Ctrl+Shift+C (Continue) and Ctrl+Shift+R (Regenerate), RoleCall's shortcuts. One document-level listener
 * per chord that calls the page's one handler, the same one the bubble's button calls; it does nothing when
 * `enabled` is false (a turn running, a menu, wing, dialog or editor open, nothing to act on).
 */
import { useEffect, useRef } from "react";
import type { ContinueKeyEvent } from "./continue-core";

export function useChordKey(matches: (e: ContinueKeyEvent) => boolean, run: () => void, enabled: boolean): void {
  const latest = useRef({ matches, run });
  latest.current = { matches, run };
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (!latest.current.matches(e)) return;
      e.preventDefault();
      latest.current.run();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
