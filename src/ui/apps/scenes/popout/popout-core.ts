/**
 * Where a pop-out panel sits and how its saved state reads back. RoleCall clamps the drag to `innerWidth - 380` by
 * `innerHeight - 200` (LorebookActivityFeed.tsx:716-727), which lets a 70vh panel hang off the bottom; here the clamp
 * uses the panel's real size. Pure.
 */
import { recOr } from "../../../../core/guards";
import type { SceneProp } from "../props/prop-contract";
import type { PopoutKind, PopoutState } from "./popout-kind";

export const POPOUT_WIDTH = 380;
export const POPOUT_TOP = 100;
/** Gap from the right edge on first open (RoleCall: `innerWidth - 400` for a 380 panel). */
const EDGE_GAP = 20;

export interface Box { width: number; height: number }
export interface Pos { x: number; y: number }

const within = (v: number, max: number): number => Math.max(0, Math.min(max, v));

/** Keeps the panel's whole box inside the view; a panel taller or wider than the view sticks to the top left. */
export const clampPopout = (pos: Pos, size: Box, view: Box): Pos => ({ x: within(pos.x, view.width - size.width), y: within(pos.y, view.height - size.height) });

/** Where a kind opens before it has ever been dragged. */
export const defaultPopout = (kind: Pick<PopoutKind, "width" | "top">, view: Box): Pos => ({ x: view.width - (kind.width ?? POPOUT_WIDTH) - EDGE_GAP, y: kind.top ?? POPOUT_TOP });

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The saved value, fail closed: anything that is not `{ open: boolean, x?, y? }` reads as closed and unplaced. */
export function parsePopout(raw: unknown): PopoutState {
  const r = recOr(raw);
  return { open: r["open"] === true, pos: finite(r["x"]) && finite(r["y"]) ? { x: r["x"], y: r["y"] } : null };
}

/** What gets saved: the open flag and the place, flat. */
export const popoutValue = (s: PopoutState): { open: boolean; x?: number; y?: number } => ({ open: s.open, ...(s.pos ?? {}) });

/** The kinds the host may float: every wing kind, and a Prop's only while the Prop is on (the stage rule). */
export function popoutKindsFor(wing: readonly PopoutKind[], props: readonly SceneProp[], on: readonly string[]): PopoutKind[] {
  return [...wing, ...props.filter((p) => on.includes(p.id)).flatMap((p) => [...(p.panel ? [p.panel] : []), ...(p.popouts ?? [])])];
}
