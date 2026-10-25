/**
 * The panel every wing is drawn in (RoleCall `WingPanelContainer.tsx`): the surface with its gradient edge on the side facing the rail, depth shadow and sheen, and the drag edge on the
 * side facing the chat. `WingSlot` is the box the panel opens in: it holds its width in the default theme (the chat is pushed by the same width, 300ms) and stays empty when closed.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import type { Wing } from "./scene-wing-data";
import { WingResizeEdge, type WingResize } from "./wing-resize-edge";

export function WingFrame({ wing, extra, resize, children }: { wing: Wing; extra?: string; resize?: WingResize; children: ReactNode }): JSX.Element {
  return (
    <section className={`wing-panel ${wing.side}${extra ? ` ${extra}` : ""}`} data-part="scene.wings.panel" data-wing={wing.id} style={{ "--w": wing.tone } as CSSProperties} aria-label={wing.label}>
      <i className="wp-edge" aria-hidden="true" />
      <i className="wp-depth" aria-hidden="true" />
      <i className="wp-sheen" aria-hidden="true" />
      {resize && <WingResizeEdge side={wing.side} label={wing.label} {...resize} />}
      {children}
    </section>
  );
}

/** One side's box for the open wing. Its width is the scene root's `--wing-w`; the rail reads its `data-*` to place its labels. */
export function WingSlot({ side, open, children }: { side: "l" | "r"; open: boolean; children?: ReactNode }): JSX.Element {
  return <div className={`wslot ${side}${open ? " open" : ""}`} data-wing-panel data-wing-side={side} data-wing-open={open ? "true" : "false"}>{children}</div>;
}
