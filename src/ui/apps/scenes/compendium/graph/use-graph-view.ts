/**
 * The explorer's camera: drag the background to pan, the wheel to zoom about the pointer, the zoom buttons and FIT (RoleCall leaves
 * these to react-force-graph, `GraphExploreModal.tsx:139-160,366-380`; its +/- step is 1.3 and 0.77). A press that does not move is a
 * click on the background, which deselects. The view is one state, so the node layer (graph-canvas.tsx) never redraws for it.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { fitView, zoomAt, type Extent, type View } from "./graph-core";

const FALLBACK: Extent = { width: 1000, height: 700 };
const STEP = 1.3;
/** A press that moves less than this many px is a click. */
const CLICK_SLOP = 3;

export interface GraphView {
  stage: RefObject<HTMLDivElement | null>;
  view: View;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Handlers for the SVG: pan, and a still press on the background. */
  pan: { onPointerDown(e: ReactPointerEvent<SVGSVGElement>): void; onPointerMove(e: ReactPointerEvent<SVGSVGElement>): void; onPointerUp(e: ReactPointerEvent<SVGSVGElement>): void };
}

export function useGraphView(points: () => { x: number; y: number; r: number }[], onBackground: () => void): GraphView {
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const held = useRef({ points, onBackground });
  held.current = { points, onBackground };
  const press = useRef<{ x: number; y: number; from: View; moved: boolean } | null>(null);

  const canvas = useCallback((): Extent => {
    const r = stage.current?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { width: r.width, height: r.height } : FALLBACK;
  }, []);
  const fit = useCallback(() => setView(fitView(held.current.points(), canvas())), [canvas]);
  const zoom = useCallback((factor: number, at?: { x: number; y: number }) => {
    const c = canvas();
    setView((v) => zoomAt(v, factor, at ?? { x: c.width / 2, y: c.height / 2 }));
  }, [canvas]);

  useLayoutEffect(fit, [fit]);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [zoom]);

  return {
    stage, view, fit, zoomIn: () => zoom(STEP), zoomOut: () => zoom(1 / STEP),
    pan: {
      onPointerDown: (e) => {
        if ((e.target as Element).closest("[data-node]")) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press.current = { x: e.clientX, y: e.clientY, from: view, moved: false };
      },
      onPointerMove: (e) => {
        const p = press.current;
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!p.moved && Math.abs(dx) + Math.abs(dy) < CLICK_SLOP) return;
        p.moved = true;
        setView({ ...p.from, x: p.from.x + dx, y: p.from.y + dy });
      },
      onPointerUp: () => {
        const p = press.current;
        press.current = null;
        if (p && !p.moved) held.current.onBackground();
      },
    },
  };
}
