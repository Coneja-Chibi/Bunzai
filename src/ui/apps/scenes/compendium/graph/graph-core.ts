/**
 * The cross-reference explorer's pure side (RoleCall `GraphExploreModal.tsx` and `graph/edgeKind.ts`): the five edge kinds, which
 * nodes and links the filters leave, what a node connects to, zoom about the pointer, fit to screen, and the layout. RoleCall
 * runs a live physics canvas; here the whole graph is settled once with `core/lore/web-layout.ts` and cached by graph, so a book is
 * laid out once per revision and the filters only hide. Unlike RoleCall's modal, which lists nine entry types and so never shows a
 * creature or a power, every one of the eleven types can show. Pure.
 */
import { ENTRY_TYPES, type CrossRefGraph, type CrossRefNode, type EntryType } from "../../../../../core/compendium";
import { seedLayout, stepLayout } from "../../../../../core/lore";

export type EdgeKind = "relationship" | "affiliation" | "location" | "participant" | "mention";

/** RoleCall's palette order and labels; `token` is a theme token and `dash` the SVG dash array. */
export const EDGE_KINDS: readonly { kind: EdgeKind; label: string; token: string; dash?: string }[] = [
  { kind: "relationship", label: "Relationships", token: "--bk-role-warn" },
  { kind: "affiliation", label: "Affiliations", token: "--bk-role-action", dash: "5 3" },
  { kind: "location", label: "Location Links", token: "--bk-role-info" },
  { kind: "participant", label: "Participation", token: "--bk-role-select", dash: "2 3" },
  { kind: "mention", label: "In Summaries", token: "--bk-text-dim", dash: "3 5" },
];

const KIND_OF: Readonly<Record<string, EdgeKind>> = {
  relationship: "relationship", ally: "relationship", enemy: "relationship", leader: "relationship", member: "relationship", owner: "relationship", inhabitant: "relationship", central_character: "relationship",
  affiliation: "affiliation", faction_present: "affiliation", involved_organization: "affiliation", headquarters: "affiliation",
  current_location: "location", parent_location: "location", connected_to: "location", where: "location", key_location: "location", involved_location: "location", territory: "location",
  participant: "participant", related_plot: "participant", parent_plot: "participant", affected_target: "participant", stopper: "participant", source: "participant",
  applies_to: "mention", related_to: "mention",
};

/** RoleCall's map; an edge it does not name falls in the last bucket, as there. */
export const edgeKindOf = (raw: string): EdgeKind => KIND_OF[raw] ?? "mention";
export const edgeLabel = (raw: string): string => raw.replace(/_/g, " ");

export interface Link { from: string; to: string; edge: string; kind: EdgeKind }
export interface Filters { types: ReadonlySet<EntryType>; kinds: ReadonlySet<EdgeKind>; orphans: boolean }
export interface Extent { width: number; height: number }
export interface View { x: number; y: number; k: number }

export const allFilters = (): Filters => ({ types: new Set(ENTRY_TYPES), kinds: new Set(EDGE_KINDS.map((e) => e.kind)), orphans: true });

/** Links with both ends in the book; a dangling name and a self reference are not drawn (RoleCall drops the first, a self loop is no connection). */
export const resolvedLinks = (g: CrossRefGraph): Link[] =>
  g.edges.filter((e) => e.toId !== undefined && e.toId !== e.fromId).map((e) => ({ from: e.fromId, to: e.toId!, edge: e.edge, kind: edgeKindOf(e.edge) }));

/** The nodes and links the filters leave: a type off hides its nodes and their links, a kind off its links, orphans off the nodes nothing visible reaches. */
export function visibleOf(g: CrossRefGraph, links: readonly Link[], f: Filters): { nodes: CrossRefNode[]; links: Link[] } {
  let nodes = g.nodes.filter((n) => f.types.has(n.type));
  const ids = new Set(nodes.map((n) => n.id));
  const shown = links.filter((l) => f.kinds.has(l.kind) && ids.has(l.from) && ids.has(l.to));
  if (!f.orphans) {
    const linked = new Set(shown.flatMap((l) => [l.from, l.to]));
    nodes = nodes.filter((n) => linked.has(n.id));
  }
  return { nodes, links: shown };
}

/** Who a node connects to, once per (other, edge type). */
export function connectionsOf(links: readonly Link[], id: string): { other: string; edge: string; kind: EdgeKind }[] {
  const seen = new Set<string>();
  const out: { other: string; edge: string; kind: EdgeKind }[] = [];
  for (const l of links) {
    const other = l.from === id ? l.to : l.to === id ? l.from : null;
    if (other === null || seen.has(`${other}::${l.edge}`)) continue;
    seen.add(`${other}::${l.edge}`);
    out.push({ other, edge: l.edge, kind: l.kind });
  }
  return out;
}

/** The node and everything one link away: what stays lit while one is hovered or selected. */
export const neighbours = (links: readonly Link[], id: string): Set<string> => new Set([id, ...links.flatMap((l) => (l.from === id ? [l.to] : l.to === id ? [l.from] : []))]);

export function searchHits(nodes: readonly CrossRefNode[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  return new Set(q ? nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id) : []);
}

/** RoleCall's four sizes by how often an entry is referenced. */
export const nodeSize = (refs: number): number => (refs >= 10 ? 56 : refs >= 5 ? 46 : refs >= 2 ? 38 : 30);

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;
const clampZoom = (k: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));

/** Zooms by `factor` about a point of the canvas, which stays under the pointer. */
export function zoomAt(v: View, factor: number, at: { x: number; y: number }): View {
  const k = clampZoom(v.k * factor);
  return { k, x: at.x - ((at.x - v.x) / v.k) * k, y: at.y - ((at.y - v.y) / v.k) * k };
}

/** The view that shows every point with `pad` px around it, centred (RoleCall `zoomToFit(400, 60)`). */
export function fitView(points: readonly { x: number; y: number; r: number }[], canvas: Extent, pad = 60): View {
  if (points.length === 0) return { x: 0, y: 0, k: 1 };
  const x0 = Math.min(...points.map((p) => p.x - p.r));
  const x1 = Math.max(...points.map((p) => p.x + p.r));
  const y0 = Math.min(...points.map((p) => p.y - p.r));
  const y1 = Math.max(...points.map((p) => p.y + p.r));
  const k = clampZoom(Math.min((canvas.width - 2 * pad) / Math.max(1, x1 - x0), (canvas.height - 2 * pad) / Math.max(1, y1 - y0)));
  return { k, x: canvas.width / 2 - ((x0 + x1) / 2) * k, y: canvas.height / 2 - ((y0 + y1) / 2) * k };
}

export interface GraphLayout { at: ReadonlyMap<string, { x: number; y: number }>; box: Extent }

const MAX_TICKS = 120;
const MIN_TICKS = 6;
/** Pair visits one layout may spend (every step is n squared over two); a bigger book settles in fewer steps. */
const WORK = 2e7;
export const ticksFor = (n: number): number => Math.max(MIN_TICKS, Math.min(MAX_TICKS, Math.floor(WORK / Math.max(1, n * n))));

/** Lays the whole graph out: every typed entry, whatever the filters say, so hiding and showing never moves a node. */
export function settleLayout(g: CrossRefGraph): GraphLayout {
  const ids = g.nodes.map((n) => n.id);
  const side = Math.max(900, Math.ceil(Math.sqrt(ids.length)) * 110);
  const box = { width: Math.round(side * 1.4), height: side };
  const edges = resolvedLinks(g).map((l) => ({ from: l.from, to: l.to }));
  let nodes = seedLayout(ids, edges, box);
  for (let i = ticksFor(ids.length); i > 0; i--) nodes = stepLayout(nodes, edges, box);
  return { at: new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])), box };
}

/** One layout per graph object: the book model builds a new graph only when the book's revision changes. */
export function createLayoutCache(compute: (g: CrossRefGraph) => GraphLayout = settleLayout): (g: CrossRefGraph) => GraphLayout {
  const done = new WeakMap<CrossRefGraph, GraphLayout>();
  return (g) => {
    const hit = done.get(g);
    if (hit) return hit;
    const made = compute(g);
    done.set(g, made);
    return made;
  };
}

export const sharedLayoutOf = createLayoutCache();
