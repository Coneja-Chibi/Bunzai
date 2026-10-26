/**
 * The one bottom-of-scene action toast: a message and one action button ("Redo", "Undo"). Styled by the scene
 * stylesheet's `.edittoast`. With `onDismiss` it closes itself after FLASH_MS.undo; a new message restarts the
 * clock, a new callback closure does not.
 */
import type { JSX } from "react";
import { Button } from "../components/button";
import { FLASH_MS, useAutoDismiss } from "./use-flash";

export function Toast({ message, actionLabel, onAction, onDismiss }: { message: string; actionLabel: string; onAction(): void; onDismiss?: () => void }): JSX.Element {
  useAutoDismiss(onDismiss ? message : null, FLASH_MS.undo, () => onDismiss?.());
  return (
    <div className="edittoast" role="status">
      <span className="grow">{message}</span>
      <Button size="sm" onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}
