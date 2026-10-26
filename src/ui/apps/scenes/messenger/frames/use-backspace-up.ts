/**
 * Backspace goes up one deeper settings page (approved wireframe messenger-discord/settings.html), except while a field
 * is being typed in or another handler already used the press. Live only while there is a page to go back from.
 */
import { useEffect } from "react";
import { isTypingTarget } from "../../../../_shared/typing-target";

export function useBackspaceUp(active: boolean, up: () => void): void {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Backspace" || e.defaultPrevented || isTypingTarget(e.target)) return;
      e.preventDefault();
      up();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, up]);
}
