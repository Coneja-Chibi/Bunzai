/** One mounted app tree, moved between the workspace and its floating overlay without resetting drafts. */
import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DialogDepth } from "../components/dialog-core";

export function AppSurface({ workspace, overlay, visible = true, children }: { workspace: HTMLElement | null; overlay: HTMLElement | null; visible?: boolean; children: ReactNode }) {
  const [container] = useState(() => {
    const node = document.createElement("div");
    node.className = "studio-app-surface";
    return node;
  });
  useLayoutEffect(() => {
    container.hidden = !visible;
    const target = overlay ?? workspace;
    const focused = container.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    target?.append(container);
    focused?.focus({ preventScroll: true });
  }, [container, workspace, overlay, visible]);
  useLayoutEffect(() => () => container.remove(), [container]);
  return createPortal(<DialogDepth.Provider value={overlay ? 1 : 0}>{children}</DialogDepth.Provider>, container);
}
