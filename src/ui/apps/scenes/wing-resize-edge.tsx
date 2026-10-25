/**
 * The drag edge every wing shares (RoleCall `WingPanelContainer.tsx` resize handle): an 8px separator on the edge that faces the chat, with an accent line on hover and while dragged.
 * Dragging away from the rail widens the wing, a key moves it a step, Home or a double click puts the wing's own default back. The width follows the pointer without saving or re-rendering
 * the page (`onLive` writes the CSS variable); it is saved once, when the pointer lifts (a drag is one change, not a hundred writes). The window listeners are one stable pair, so lifting
 * the pointer (or leaving the scene mid-drag) always removes the ones that were added.
 */
import { useEffect, useRef, useState, type JSX, type KeyboardEvent, type PointerEvent } from "react";
import { clampWidth, MIN_WIDTH, STEP } from "./wing-resize-core";

/** What a wing's edge needs of the page: the wing's width now, where it goes back to, and the three ways a change leaves the edge. */
export interface WingResize {
  width: number;
  fallback: number;
  available(): number;
  onLive(px: number): void;
  onDragging(on: boolean): void;
  onSave(px: number | null): void;
}

export function WingResizeEdge(props: WingResize & { side: "l" | "r"; label: string }): JSX.Element {
  const { width, side, label } = props;
  const latest = useRef(props);
  latest.current = props;
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; from: number; now: number } | null>(null);
  const handlers = useRef<{ move(e: MouseEvent): void; up(): void } | null>(null);
  // The edge faces the chat: a left wing grows as the pointer goes right, a right wing as it goes left.
  const sign = side === "l" ? 1 : -1;
  if (!handlers.current) {
    const stop = (): void => {
      window.removeEventListener("pointermove", handlers.current!.move);
      window.removeEventListener("pointerup", handlers.current!.up);
    };
    handlers.current = {
      move: (e) => {
        const d = drag.current;
        if (!d) return;
        d.now = clampWidth(d.from + (e.clientX - d.x) * (latest.current.side === "l" ? 1 : -1), latest.current.available());
        latest.current.onLive(d.now);
      },
      up: () => {
        const d = drag.current;
        drag.current = null;
        stop();
        setDragging(false);
        latest.current.onDragging(false);
        if (d && d.now !== d.from) latest.current.onSave(d.now);
      },
    };
  }
  useEffect(() => () => {
    window.removeEventListener("pointermove", handlers.current!.move);
    window.removeEventListener("pointerup", handlers.current!.up);
    if (drag.current) latest.current.onDragging(false);
  }, []);
  const down = (e: PointerEvent): void => {
    e.preventDefault();
    drag.current = { x: e.clientX, from: width, now: width };
    setDragging(true);
    props.onDragging(true);
    window.addEventListener("pointermove", handlers.current!.move);
    window.addEventListener("pointerup", handlers.current!.up);
  };
  const reset = (): void => { props.onLive(props.fallback); props.onSave(null); };
  const step = (by: number): void => { const next = clampWidth(width + by, props.available()); props.onLive(next); props.onSave(next); };
  const key = (e: KeyboardEvent): void => {
    if (e.key === "ArrowLeft") step(-sign * STEP);
    else if (e.key === "ArrowRight") step(sign * STEP);
    else if (e.key === "Home") reset();
    else return;
    e.preventDefault();
  };
  return (
    <div
      className={`wedge ${side}${dragging ? " drag" : ""}`} role="separator" aria-orientation="vertical" aria-label={`Resize the ${label} wing`} aria-valuenow={width} aria-valuemin={MIN_WIDTH}
      data-wing-panel-ignore-outside tabIndex={0} title="Drag to resize. Double click to reset." onPointerDown={down} onKeyDown={key} onDoubleClick={reset}
    />
  );
}
