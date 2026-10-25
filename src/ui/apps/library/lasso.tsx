/**
 * The dragged selection box, drawn on document.body.
 *
 * WHY A PORTAL. The box is `position: fixed` and measured in viewport coordinates, like the cards it
 * tests. The Library root is a size container (`container-type: inline-size`, so the room collapses
 * by its own pane width), and a container is also the containing block for fixed descendants: drawn
 * inside the room, the box landed offset by the shell's dock and bars. Drawn on body, viewport
 * coordinates mean the viewport again. The shell's dialogs escape the same way (InkDialog).
 */
import { createPortal } from "react-dom";
import { useContext, type JSX } from "react";
import { DialogDepth } from "../../components/dialog-core";

export function Lasso({ box }: { box: { left: number; top: number; right: number; bottom: number } | null }): JSX.Element | null {
  const depth = useContext(DialogDepth);
  if (!box || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="dv-lasso"
      style={{ zIndex: 60 + depth * 1000 + (depth ? 200 : 0), left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }}
    />,
    document.body,
  );
}
