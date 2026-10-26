/**
 * The Nodes view's persisted canvas (pure): parse the prefs record once at the boundary, serialize it
 * back, the drag edits (nodes, board items, pinned notes) and the deterministic tidy layout.
 * Board items that fail to parse are kept verbatim and written back untouched; a parsed item keeps any keys this
 * build does not know; a record from a newer version is never overwritten (`frozen`).
 */
import { isRecord } from "../../../../core/guards";
import { clampZoom, nodeHeight, NODE_W, type Pt } from "./geometry";
import { portsOf, type GraphEdge, type GraphNode } from "./links";

export const PREF_VIEW = "workbench.view";
export const PREF_NODES = "workbench.nodes";

export type View = "desk" | "nodes";
export const parseView = (raw: unknown): View => (raw === "nodes" ? "nodes" : "desk");

export interface BoardItem {
  id: string;
  type: "note" | "frame" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  pin?: string;
  asset?: string;
  /** keys this build does not know, written back untouched */
  extra?: Record<string, unknown>;
}

export interface CanvasState {
  v: 1;
  layers: { links: boolean; pipeline: boolean; board: boolean };
  zoom: number;
  pan: Pt;
  pos: Record<string, Pt>;
  board: BoardItem[];
  /** board entries this build could not read, written back as they came */
  unknownItems: unknown[];
  /** the stored record came from a newer version: show the defaults, never save over it */
  frozen: boolean;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pair = (v: unknown): Pt | null => (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) ? [v[0], v[1]] : null);

const ITEM_KEYS = new Set(["id", "type", "x", "y", "w", "h", "text", "pin", "asset"]);
const extraOf = (raw: Record<string, unknown>): Record<string, unknown> | null => {
  const rest = Object.fromEntries(Object.entries(raw).filter(([k]) => !ITEM_KEYS.has(k)));
  return Object.keys(rest).length ? rest : null;
};

function parseItem(raw: unknown): BoardItem | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  if (raw.type !== "note" && raw.type !== "frame" && raw.type !== "image") return null;
  if (!num(raw.x) || !num(raw.y) || !num(raw.w) || !num(raw.h) || raw.w <= 0 || raw.h <= 0) return null;
  for (const k of ["text", "pin", "asset"] as const) if (raw[k] !== undefined && typeof raw[k] !== "string") return null;
  return {
    id: raw.id, type: raw.type, x: raw.x, y: raw.y, w: raw.w, h: raw.h,
    ...(typeof raw.text === "string" ? { text: raw.text } : {}),
    ...(typeof raw.pin === "string" ? { pin: raw.pin } : {}),
    ...(typeof raw.asset === "string" ? { asset: raw.asset } : {}),
    ...(extraOf(raw) ? { extra: extraOf(raw)! } : {}),
  };
}

export function parseCanvas(raw: unknown): CanvasState {
  const frozen = isRecord(raw) && num(raw.v) && raw.v > 1;
  const r = isRecord(raw) && raw.v === 1 ? raw : {};
  const layers = isRecord(r.layers) ? r.layers : {};
  const pos: Record<string, Pt> = {};
  if (isRecord(r.pos)) for (const [k, v] of Object.entries(r.pos)) { const p = pair(v); if (p) pos[k] = p; }
  const board: BoardItem[] = [];
  const unknownItems: unknown[] = [];
  if (Array.isArray(r.board)) for (const entry of r.board) { const item = parseItem(entry); if (item) board.push(item); else unknownItems.push(entry); }
  return {
    v: 1,
    layers: { links: layers.links !== false, pipeline: layers.pipeline !== false, board: layers.board !== false },
    zoom: num(r.zoom) ? clampZoom(r.zoom) : 1,
    pan: pair(r.pan) ?? [0, 0],
    pos,
    board,
    unknownItems,
    frozen,
  };
}

export function serializeCanvas(s: CanvasState): Record<string, unknown> {
  const items = s.board.map(({ extra, ...known }) => (extra ? { ...extra, ...known } : known));
  return { v: 1, layers: s.layers, zoom: s.zoom, pan: [...s.pan], pos: s.pos, board: [...items, ...s.unknownItems] };
}

/** What a drag moves: node positions and board item positions at the moment it began. */
export interface DragSnapshot { nodes: Record<string, Pt>; items: Record<string, Pt> }

/** Snapshot the given nodes, board items, and every note pinned to one of those nodes. */
export function snapshotDrag(s: CanvasState, at: (key: string) => Pt, nodeKeys: readonly string[], itemIds: readonly string[]): DragSnapshot {
  const nodes: Record<string, Pt> = {};
  for (const k of nodeKeys) nodes[k] = at(k);
  const items: Record<string, Pt> = {};
  for (const i of s.board) if (itemIds.includes(i.id) || (i.pin !== undefined && i.pin in nodes)) items[i.id] = [i.x, i.y];
  return { nodes, items };
}

/** The state with everything in the snapshot shifted by (dx, dy) from where it began. */
export function applyDrag(s: CanvasState, snap: DragSnapshot, dx: number, dy: number): CanvasState {
  const pos = { ...s.pos };
  for (const [k, p] of Object.entries(snap.nodes)) pos[k] = [p[0] + dx, p[1] + dy];
  const board = s.board.map((i) => { const p = snap.items[i.id]; return p ? { ...i, x: p[0] + dx, y: p[1] + dy } : i; });
  return { ...s, pos, board };
}

/** Deterministic layered layout: pieces with ports in column 0, the rest in column 1 (ordered by the first piece that links them), ghosts in column 2. */
export function tidy(nodes: readonly Pick<GraphNode, "key" | "kind" | "ghost">[], edges: readonly Pick<GraphEdge, "from" | "to">[]): Record<string, Pt> {
  const COL_W = NODE_W + 90;
  const GAP = 24;
  const colOf = (n: Pick<GraphNode, "kind" | "ghost">): number => (n.ghost ? 2 : portsOf(n.kind).length ? 0 : 1);
  const sources = nodes.filter((n) => colOf(n) === 0).map((n) => n.key).sort();
  const firstSource = (key: string): number => Math.min(...edges.filter((e) => e.to === key).map((e) => sources.indexOf(e.from)), Infinity);
  const ordered = nodes.map((n) => ({ n, col: colOf(n), rank: colOf(n) === 0 ? 0 : firstSource(n.key) }))
    .sort((a, b) => a.col - b.col || a.rank - b.rank || a.n.key.localeCompare(b.n.key));
  const heights = [60, 60, 60];
  const out: Record<string, Pt> = {};
  for (const { n, col } of ordered) {
    out[n.key] = [40 + col * COL_W, heights[col]!];
    heights[col] = heights[col]! + nodeHeight(n.kind) + GAP;
  }
  return out;
}
