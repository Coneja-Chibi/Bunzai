/** A split editor owns keys from its own frame; only the primary pane handles workspace-level shortcuts. */
import { createContext, useContext, useEffect } from "react";
import { AppActivity, canUseAppShortcut } from "../../_shared/app-activity";

interface KeyOwner { root: HTMLElement | null; primary: boolean }
export const EditorKeyOwner = createContext<KeyOwner | null>(null);

function ownsEditorKey(event: KeyboardEvent, owner: KeyOwner | null): boolean {
  if (!canUseAppShortcut(event)) return false;
  if (!owner) return true;
  const target = event.target instanceof Element ? event.target : null;
  return target?.closest('[data-editor="frame"]') ? owner.root?.contains(target) === true : owner.primary;
}

export function useEditorKeys(handle: (event: KeyboardEvent) => void): void {
  const active = useContext(AppActivity);
  const owner = useContext(EditorKeyOwner);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (active && ownsEditorKey(event, owner)) handle(event); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, owner, handle]);
}
