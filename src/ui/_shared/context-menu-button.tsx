/** Open the nearest existing context-menu target from a visible, keyboard-accessible button. */
import type { JSX } from "react";
import { Ic } from "./ic";

export function ContextMenuButton({ name, className }: { name: string; className: string }): JSX.Element {
  return <button type="button" className={className} aria-label={`More for ${name}`} title="More"
    onClick={(event) => {
      event.stopPropagation();
      const box = event.currentTarget.getBoundingClientRect();
      event.currentTarget.dispatchEvent(new window.MouseEvent("contextmenu", {
        bubbles: true, cancelable: true, clientX: box.left, clientY: box.bottom,
      }));
    }} onKeyDown={(event) => { if (event.key !== "Tab") event.stopPropagation(); }}>
    <Ic name="lucide:ellipsis" size={16} />
  </button>;
}
