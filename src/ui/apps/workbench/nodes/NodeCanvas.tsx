/**
 * The pan/zoom canvas: draws nodes, wires and the board, and owns every pointer gesture (pan, zoom,
 * node and board drags, wire drags from a port, Delete on a selected wire). It writes nothing itself;
 * linking and unlinking are handed to the caller.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, JSX, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { deckMeta } from "../../../_shared/decks";
import { BoardLayer } from "./Board";
import { PieceNode } from "./PieceNode";
import { applyDrag, snapshotDrag, type BoardItem, type CanvasState } from "./canvas-state";
import {
  boundsOf, clampZoom, inAnchor, inside, nodeRect, outAnchor, within, wirePath, MAX_ZOOM, MIN_ZOOM,
  type Pt, type Rect,
} from "./geometry";
import { canLink, portsOf, type GraphEdge, type GraphNode, type RefField } from "./links";
import css from "./nodes.module.css";

export type Selection = { t: "node"; key: string } | { t: "wire"; id: string } | { t: "item"; id: string } | null;
export interface Size { w: number; h: number }

export interface NodeCanvasProps {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  at(key: string): Pt;
  canvas: CanvasState;
  edit(fn: (s: CanvasState) => CanvasState): void;
  readOnly: boolean;
  dirty: Readonly<Record<string, boolean>>;
  selection: Selection;
  select(s: Selection): void;
  editingId: string | null;
  setEditingId(id: string | null): void;
  size: Size;
  onSize(size: Size): void;
  onOpen(node: GraphNode): void;
  onBringUp(node: GraphNode): void;
  onLink(from: GraphNode, field: RefField, to: GraphNode): void;
  onUnlink(edge: GraphEdge): void;
  /** extra nodes drawn in the world (the Pipeline layer); `drag` moves one by its canvas key */
  layer?(drag: (e: PointerEvent, key: string) => void): ReactNode;
  /** the layer's rectangles, for the minimap */
  layerRects?: readonly Rect[];
}

const MINI = { w: 170, h: 104 };
const itemRect = (i: BoardItem): Rect => ({ x: i.x, y: i.y, w: i.w, h: i.h });
const pathOf = wirePath;

export function NodeCanvas(p: NodeCanvasProps): JSX.Element {
  const { canvas, edit } = p;
  const root = useRef<HTMLDivElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const [wire, setWire] = useState<{ from: GraphNode; field: RefField; to: Pt } | null>(null);
  const showNodes = canvas.layers.links;
  const nodes = showNodes ? p.nodes : [];
  const byKey = new Map(p.nodes.map((n) => [n.key, n] as const));
  const portRow = (n: GraphNode, field: RefField): number => Math.max(0, portsOf(n.kind).findIndex((x) => x.field === field));

  function zoomAt(px: number, py: number, factor: number): void {
    edit((s) => {
      const zoom = clampZoom(s.zoom * factor);
      const k = zoom / s.zoom;
      return { ...s, zoom, pan: [px - (px - s.pan[0]) * k, py - (py - s.pan[1]) * k] };
    });
  }
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => () => stop.current?.(), []);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = (): void => p.onSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAtRef.current(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", onWheel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toWorld = (cx: number, cy: number): Pt => {
    const r = root.current?.getBoundingClientRect();
    return [(cx - (r?.left ?? 0) - canvas.pan[0]) / canvas.zoom, (cy - (r?.top ?? 0) - canvas.pan[1]) / canvas.zoom];
  };

  /** One drag: window-level move/up listeners, ignoring the first 3px so a click stays a click. */
  function track(e: PointerEvent, move: (dx: number, dy: number, ev: globalThis.PointerEvent) => void, end?: (ev: globalThis.PointerEvent, moved: boolean) => void): void {
    stop.current?.();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const onMove = (ev: globalThis.PointerEvent): void => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      move(dx, dy, ev);
    };
    const release = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      stop.current = null;
    };
    const onUp = (ev: globalThis.PointerEvent): void => { release(); end?.(ev, moved); };
    // a cancelled gesture is never a drop: it ends as if nothing moved, so it cannot link
    const onCancel = (ev: globalThis.PointerEvent): void => { release(); end?.(ev, false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    stop.current = release;
  }

  const onBackgroundDown = (e: PointerEvent): void => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    root.current?.focus();
    const [x0, y0] = canvas.pan;
    track(e, (dx, dy) => edit((s) => ({ ...s, pan: [x0 + dx, y0 + dy] })), (_ev, moved) => { if (!moved) p.select(null); });
  };

  const dragBy = (e: PointerEvent, nodeKeys: string[], itemIds: string[]): void => {
    const snap = snapshotDrag(canvas, p.at, nodeKeys, itemIds);
    const z = canvas.zoom;
    track(e, (dx, dy) => edit((s) => applyDrag(s, snap, dx / z, dy / z)));
  };

  const onLayerDown = (e: PointerEvent, key: string): void => {
    if (e.button !== 0) return;
    root.current?.focus();
    if (!p.readOnly) dragBy(e, [key], []);
  };

  const onNodeDown = (e: PointerEvent, node: GraphNode): void => {
    if (e.button !== 0) return;
    p.select({ t: "node", key: node.key });
    root.current?.focus();
    if (!p.readOnly) dragBy(e, [node.key], []);
  };

  const onItemDown = (e: PointerEvent, item: BoardItem): void => {
    if (e.button !== 0) return;
    p.select({ t: "item", id: item.id });
    root.current?.focus();
    if (p.readOnly) return;
    if (item.type !== "frame") return dragBy(e, [], [item.id]);
    const frame = itemRect(item);
    dragBy(
      e,
      nodes.filter((n) => inside(frame, nodeRect(n.kind, p.at(n.key)))).map((n) => n.key),
      [item.id, ...canvas.board.filter((i) => i.id !== item.id && inside(frame, itemRect(i))).map((i) => i.id)],
    );
  };

  const onResizeDown = (e: PointerEvent, item: BoardItem): void => {
    e.stopPropagation();
    const z = canvas.zoom;
    track(e, (dx, dy) => edit((s) => ({
      ...s, board: s.board.map((i) => (i.id === item.id ? { ...i, w: Math.max(80, item.w + dx / z), h: Math.max(60, item.h + dy / z) } : i)),
    })));
  };

  const onPortDown = (e: PointerEvent, node: GraphNode, field: RefField): void => {
    if (e.button !== 0) return;
    p.select({ t: "node", key: node.key });
    setWire({ from: node, field, to: toWorld(e.clientX, e.clientY) });
    track(
      e,
      (_dx, _dy, ev) => setWire((w) => (w ? { ...w, to: toWorld(ev.clientX, ev.clientY) } : w)),
      (ev, moved) => {
        setWire(null);
        if (!moved) return;
        const pt = toWorld(ev.clientX, ev.clientY);
        const hit = [...nodes].reverse().find((n) => n.key !== node.key && within(nodeRect(n.kind, p.at(n.key)), pt));
        if (hit && canLink(node.kind, field, hit.kind) && !p.edges.some((x) => x.from === node.key && x.field === field && x.to === hit.key)) p.onLink(node, field, hit);
      },
    );
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    // keys from a dialog rendered through a portal (the request preview) bubble here in React: ignore them
    if (!root.current?.contains(e.target as Node)) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
    if (e.key === "Escape") {
      // Escape drops a wire being drawn (and stops any drag) without linking
      if (stop.current) { stop.current(); setWire(null); }
      return p.select(null);
    }
    const sel = p.selection;
    if ((e.key === "Delete" || e.key === "Backspace") && sel?.t === "wire" && !p.readOnly) {
      const edge = p.edges.find((x) => x.id === sel.id);
      if (edge) { e.preventDefault(); p.onUnlink(edge); }
    }
  };

  const zoomCentre = (factor: number): void => zoomAt(p.size.w / 2, p.size.h / 2, factor);

  // minimap: every visible rectangle plus the viewport, scaled into a small frame
  const view: Rect = { x: -canvas.pan[0] / canvas.zoom, y: -canvas.pan[1] / canvas.zoom, w: p.size.w / canvas.zoom, h: p.size.h / canvas.zoom };
  const rects = [...nodes.map((n) => nodeRect(n.kind, p.at(n.key))), ...(canvas.layers.pipeline ? p.layerRects ?? [] : []), ...(canvas.layers.board ? canvas.board.map(itemRect) : [])];
  const mb = boundsOf([...rects, view])!;
  const ms = Math.min(MINI.w / Math.max(mb.w, 1), MINI.h / Math.max(mb.h, 1));
  const mini = (r: Rect): CSSProperties => ({ left: (r.x - mb.x) * ms, top: (r.y - mb.y) * ms, width: Math.max(2, r.w * ms), height: Math.max(2, r.h * ms) });
  const onMiniDown = (e: PointerEvent): void => {
    e.stopPropagation();
    const box = e.currentTarget.getBoundingClientRect();
    const wx = mb.x + (e.clientX - box.left) / ms;
    const wy = mb.y + (e.clientY - box.top) / ms;
    edit((s) => ({ ...s, pan: [p.size.w / 2 - wx * s.zoom, p.size.h / 2 - wy * s.zoom] }));
  };

  const sel = p.selection;
  const accepting = (n: GraphNode): boolean => wire !== null && n.key !== wire.from.key && canLink(wire.from.kind, wire.field, n.kind);

  return (
    <div ref={root} className={css.canvas} tabIndex={0} data-nodes-canvas="" data-read-only={p.readOnly || undefined} onPointerDown={onBackgroundDown} onKeyDown={onKeyDown}>
      <div className={css.world} style={{ transform: `translate(${canvas.pan[0]}px, ${canvas.pan[1]}px) scale(${canvas.zoom})` }}>
        {canvas.layers.board && (
          <BoardLayer
            items={canvas.board}
            selectedId={sel?.t === "item" ? sel.id : null}
            editingId={p.editingId}
            readOnly={p.readOnly}
            pinName={(key) => byKey.get(key)?.name}
            onDown={onItemDown}
            onResizeDown={onResizeDown}
            onEdit={p.setEditingId}
            onText={(id, text) => edit((s) => ({ ...s, board: s.board.map((i) => (i.id === id ? { ...i, text } : i)) }))}
          />
        )}
        <svg className={css.wires}>
          {showNodes && p.edges.map((edge) => {
            const from = byKey.get(edge.from);
            const to = byKey.get(edge.to);
            if (!from || !to) return null;
            const d = pathOf(outAnchor(p.at(from.key), portRow(from, edge.field)), inAnchor(p.at(to.key)));
            const on = sel?.t === "wire" && sel.id === edge.id;
            return (
              <g key={edge.id} data-wire={edge.id}>
                <path className={css.wireHit} d={d} onPointerDown={(e) => { e.stopPropagation(); p.select({ t: "wire", id: edge.id }); root.current?.focus(); }} />
                <path className={`${css.wire}${on ? ` ${css.wireSel}` : ""}`} d={d} style={{ stroke: deckMeta(to.kind).accent }} />
              </g>
            );
          })}
          {wire && <path className={`${css.wire} ${css.wireDraft}`} d={pathOf(outAnchor(p.at(wire.from.key), portRow(wire.from, wire.field)), wire.to)} />}
        </svg>
        {nodes.map((n) => (
          <PieceNode
            key={n.key}
            node={n}
            at={p.at(n.key)}
            selected={sel?.t === "node" && sel.key === n.key}
            accepts={accepting(n)}
            counts={Object.fromEntries(portsOf(n.kind).map((x) => [x.field, p.edges.filter((e) => e.from === n.key && e.field === x.field).length]))}
            linkedBy={p.edges.filter((e) => e.to === n.key).map((e) => byKey.get(e.from)?.name ?? "")}
            dirty={p.dirty[n.key] === true}
            readOnly={p.readOnly}
            onDown={(e) => onNodeDown(e, n)}
            onOpen={() => p.onOpen(n)}
            onPortDown={(e, field) => onPortDown(e, n, field)}
            onBringUp={() => p.onBringUp(n)}
          />
        ))}
        {canvas.layers.pipeline && p.layer?.(onLayerDown)}
      </div>
      <div className={css.zoom} onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Zoom in" disabled={canvas.zoom >= MAX_ZOOM} onClick={() => zoomCentre(1.25)}>+</button>
        <button type="button" aria-label="Reset zoom" title="Reset to 100%" onClick={() => zoomCentre(1 / canvas.zoom)}>{Math.round(canvas.zoom * 100)}%</button>
        <button type="button" aria-label="Zoom out" disabled={canvas.zoom <= MIN_ZOOM} onClick={() => zoomCentre(0.8)}>-</button>
      </div>
      <div className={css.mini} aria-hidden="true" onPointerDown={onMiniDown}>
        {rects.map((r, i) => <i key={i} className={css.miniDot} style={mini(r)} />)}
        <span className={css.miniVp} style={mini(view)} />
      </div>
    </div>
  );
}
