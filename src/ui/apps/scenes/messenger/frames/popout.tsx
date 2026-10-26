/**
 * The Messenger popout: a floating layer over the chat that the person drags by its header. It is clamped to the viewport so it can never be lost off screen, closes on its close button and
 * on Esc, and holds one panel's body as children. Presentational: the position is local to the layer, the open state belongs to the shell.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { IconButton } from "../../../../components/button";
import { useEscapeKey } from "../../../../_shared/use-escape-key";

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }

/** The top-left corner kept wholly inside the viewport (or pinned to its top-left when the layer is larger than it). */
export function clampToViewport(at: Point, size: Size, viewport: Size): Point {
  return { x: Math.max(0, Math.min(at.x, viewport.w - size.w)), y: Math.max(0, Math.min(at.y, viewport.h - size.h)) };
}

const viewportNow = (): Size => ({ w: window.innerWidth, h: window.innerHeight });

export interface PopoutProps {
  title: string;
  onClose: () => void;
  /** the layer's width in px; its height follows the body */
  width?: number;
  /** where the layer first opens (top-left, px) */
  initial?: Point;
  /** the area the layer stays inside; defaults to the window */
  bounds?: () => Size;
  children?: ReactNode;
}

export function Popout({ title, onClose, width = 420, initial = { x: 120, y: 96 }, bounds = viewportNow, children }: PopoutProps): JSX.Element {
  const root = useRef<HTMLElement>(null);
  const [at, setAt] = useState<Point>(() => clampToViewport(initial, { w: width, h: 0 }, bounds()));
  const [dragging, setDragging] = useState(false);
  const sizeOf = useCallback((): Size => ({ w: root.current?.offsetWidth || width, h: root.current?.offsetHeight ?? 0 }), [width]);

  useEscapeKey(onClose);

  /** The window can shrink under an open layer: pull it back in. */
  useEffect(() => {
    const onResize = (): void => setAt((p) => clampToViewport(p, sizeOf(), bounds()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bounds, sizeOf]);

  const startDrag = (e: ReactPointerEvent<HTMLElement>): void => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-control]")) return;
    const grab = { x: e.clientX - at.x, y: e.clientY - at.y };
    setDragging(true);
    const move = (ev: PointerEvent): void => setAt(clampToViewport({ x: ev.clientX - grab.x, y: ev.clientY - grab.y }, sizeOf(), bounds()));
    const end = (): void => {
      setDragging(false);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  return (
    <section ref={root} className="msn-pop" data-part="scene.messenger.panel.popout-layer" role="dialog" aria-label={title} style={{ left: at.x, top: at.y, width }}>
      <header className="msn-pop-h" data-part="scene.messenger.panel.drag" data-dragging={dragging} onPointerDown={startDrag}>
        <strong>{title}</strong>
        <IconButton data-part="scene.messenger.panel.popout-close" variant="quiet" size="sm" icon="lucide:x" label="Close popout" onClick={onClose} />
      </header>
      <div className="msn-pop-b" data-part="scene.messenger.panel.popout-body">{children}</div>
    </section>
  );
}
