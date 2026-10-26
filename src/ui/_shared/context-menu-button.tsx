/** Open the nearest existing context-menu target from a visible, keyboard-accessible button. */
import type { JSX } from "react";
import { IconButton } from "../components/button";

export function ContextMenuButton({ name, className }: { name: string; className: string }): JSX.Element {
  // The caller's class places this overlay trigger on its card; the button itself is the family's.
  return <span className={className}><IconButton variant="quiet" size="sm" icon="lucide:ellipsis" label={`More for ${name}`} title="More"
    onClick={(event) => {
      event.stopPropagation();
      const box = event.currentTarget.getBoundingClientRect();
      event.currentTarget.dispatchEvent(new window.MouseEvent("contextmenu", {
        bubbles: true, cancelable: true, clientX: box.left, clientY: box.bottom,
      }));
    }} onKeyDown={(event) => { if (event.key !== "Tab") event.stopPropagation(); }} /></span>;
}
