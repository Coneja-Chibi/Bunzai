/**
 * Dragging a node in the explorer (RoleCall `GraphExploreModal.tsx:628-650`, `enableNodeDrag`, `onNodeClick`): a press on a node that
 * travels past the click slop moves that node with the pointer, at the camera's zoom, and a drop leaves it where it was dropped
 * (RoleCall frees the node on drop, so it is not pinned). The move is a session override over the settled layout: the layout is
 * not computed again and nothing is saved, as RoleCall keeps no positions either; a different graph (a new book revision) starts clean.
 * RoleCall's live physics also tugs the neighbours while the node moves; the explorer here settles once, so they stay put (named in
 * the spec). A drag is not a click: the select that follows a drop is swallowed.
 */
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface Point { x: number; y: number }

/** A press that moves less than this many px is a click. */
const CLICK_SLOP = 3;
const NONE: ReadonlyMap<string, Point> = new Map();

/** The pointer handlers; the object is stable across renders so the memoised node layer is not redrawn for a pan or a zoom. */
export interface NodeDrag {
  down(e: ReactPointerEvent<SVGElement>, id: string): void;
  move(e: ReactPointerEvent<SVGElement>, id: string): void;
  up(e: ReactPointerEvent<SVGElement>, id: string): void;
  /** True once after a drop that moved the node: the click that follows it is not a select. */
  swallowClick(): boolean;
}

/** `graph` keys the session (a new one clears every move); `home` is a node's settled place; `zoom` the camera's scale now. */
export function useNodeDrag(graph: object, home: (id: string) => Point | undefined, zoom: () => number): { moved: ReadonlyMap<string, Point>; drag: NodeDrag } {
  const [held, setHeld] = useState<{ graph: object; moved: ReadonlyMap<string, Point> }>({ graph, moved: NONE });
  const moved = held.graph === graph ? held.moved : NONE;
  const live = useRef({ graph, moved, home, zoom });
  live.current = { graph, moved, home, zoom };
  const press = useRef<{ id: string; x: number; y: number; from: Point; dragged: boolean } | null>(null);
  const swallow = useRef(false);

  const down = useCallback((e: ReactPointerEvent<SVGElement>, id: string): void => {
    if (e.button !== 0) return;
    const { moved: now, home: base } = live.current;
    const from = now.get(id) ?? base(id);
    if (!from) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { id, x: e.clientX, y: e.clientY, from, dragged: false };
    swallow.current = false;
  }, []);

  const move = useCallback((e: ReactPointerEvent<SVGElement>, id: string): void => {
    const p = press.current;
    if (!p || p.id !== id) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.dragged && Math.abs(dx) + Math.abs(dy) < CLICK_SLOP) return;
    p.dragged = true;
    const k = live.current.zoom();
    const at = { x: p.from.x + dx / k, y: p.from.y + dy / k };
    setHeld((h) => ({ graph: live.current.graph, moved: new Map(h.graph === live.current.graph ? h.moved : NONE).set(id, at) }));
  }, []);

  const up = useCallback((_e: ReactPointerEvent<SVGElement>, id: string): void => {
    const p = press.current;
    if (!p || p.id !== id) return;
    press.current = null;
    swallow.current = p.dragged;
  }, []);

  const swallowClick = useCallback((): boolean => { const s = swallow.current; swallow.current = false; return s; }, []);
  return { moved, drag: useMemo(() => ({ down, move, up, swallowClick }), [down, move, up, swallowClick]) };
}
