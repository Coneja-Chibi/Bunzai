/**
 * Copy feedback for one piece of text (RoleCall useMessageActions): copied or failed for 1.5 s. The state
 * belongs to one bubble and is dropped when its text changes (a swipe or an edit), so a late clipboard answer can
 * never label a different text. `copy` defaults to copyText, the clipboard write that has the legacy fallback.
 */
import { useCallback, useEffect, useRef } from "react";
import { copyText } from "./clipboard";
import { FLASH_MS, useFlash } from "./use-flash";

export type CopyState = "copied" | "failed" | null;

export function useCopyFeedback(text: string, copy: (text: string) => Promise<boolean> = copyText): [CopyState, () => void] {
  const { value, flash, clear } = useFlash<"copied" | "failed">(FLASH_MS.copy);
  const shown = useRef(text);
  shown.current = text;
  useEffect(() => { clear(); }, [text, clear]);
  const run = useCallback((): void => {
    const asked = text;
    void copy(asked).then((ok) => {
      if (shown.current !== asked) return;
      flash(ok ? "copied" : "failed");
    });
  }, [text, copy, flash]);
  return [value, run];
}
