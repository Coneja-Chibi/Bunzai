/**
 * Canvas geometry (pure): node sizes and port anchors derived from fixed row heights, rectangle hit
 * tests, and fit-to-view. The CSS uses the same constants, so wires land on ports without measuring the DOM.
 */
import { isTargetKind, portsOf } from "./links";

export const NODE_W = 210;
const HEAD_H = 55; // 3px kind rule + 52px header
const META_H = 22;
export const ROW_H = 26;
const FOOT_H = 1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export interface Rect { x: number; y: number; w: number; h: number }
export type Pt = readonly [number, number];

export const rowCount = (kind: string): number => portsOf(kind).length || (isTargetKind(kind) ? 1 : 0);
export const nodeHeight = (kind: string): number => HEAD_H + META_H + rowCount(kind) * ROW_H + FOOT_H;
export const nodeRect = (kind: string, at: Pt): Rect => ({ x: at[0], y: at[1], w: NODE_W, h: nodeHeight(kind) });

const rowY = (at: Pt, row: number): number => at[1] + HEAD_H + META_H + row * ROW_H + ROW_H / 2;
/** Where a wire leaves port `row` of a source node. */
export const outAnchor = (at: Pt, row: number): Pt => [at[0] + NODE_W, rowY(at, row)];
/** Where a wire enters a target node. */
export const inAnchor = (at: Pt): Pt => [at[0], rowY(at, 0)];

export const within = (r: Rect, p: Pt): boolean => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
export const inside = (outer: Rect, r: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;

export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom and pan that centre `bounds` inside a viewport of `size`, with a margin. */
export function fitView(bounds: Rect | null, size: { w: number; h: number }): { zoom: number; pan: Pt } {
  if (!bounds) return { zoom: 1, pan: [0, 0] };
  const margin = 48;
  const zoom = clampZoom(Math.min((size.w - margin * 2) / bounds.w, (size.h - margin * 2) / bounds.h));
  return { zoom, pan: [size.w / 2 - (bounds.x + bounds.w / 2) * zoom, size.h / 2 - (bounds.y + bounds.h / 2) * zoom] };
}

/** Where a derived wire leaves a piece node: the middle of its header, right edge. */
export const headAnchor = (at: Pt): Pt => [at[0] + NODE_W, at[1] + HEAD_H / 2];

/** A wire as a cubic path between two anchors. */
export const wirePath = (a: Pt, b: Pt): string => {
  const m = Math.max(40, (b[0] - a[0]) / 2);
  return `M${a[0]} ${a[1]} C${a[0] + m} ${a[1]} ${b[0] - m} ${b[1]} ${b[0]} ${b[1]}`;
};
