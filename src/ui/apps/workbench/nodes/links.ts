/**
 * The Nodes view's graph (pure): the links the kinds declare (core/links.ts) become ports and wires,
 * the graph derived from the open pieces' bodies, and the one body edit that adds or removes a link.
 */
import { LINK_PORTS, portsOf as kindPorts, refsIn } from "../../../../core/links";
import { keyOf } from "../../../_shared/piece-key";
import type { StudioEntitySummary } from "../../../app-contract";
import { attachKnowledgeRef, detachKnowledgeRef } from "../lore/knowledge-refs";

/** A link field name, as the kinds declare them (src/entities/<kind>/kind.ts, read through core/links.ts). */
export type RefField = string;

/** Structured references have their own authoring surface and cannot be edited as flat arrays here. */
export const portsOf = (kind: string) => kindPorts(kind).filter((p) => !p.read);
export const isTargetKind = (kind: string): boolean => LINK_PORTS.some((p) => p.to === kind);
export const canLink = (fromKind: string, field: RefField, toKind: string): boolean =>
  portsOf(fromKind).some((p) => p.field === field && p.to === toKind);

export const refsOf = refsIn;

/** The body with one id attached or detached; an emptied field is removed, as the editors do. */
export function withRef<B extends object>(body: B, field: RefField, id: string, on: boolean): B {
  const current = refsOf(body, field);
  const next = on ? attachKnowledgeRef(current, id) : detachKnowledgeRef(current, id);
  const out: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  if (next.length) out[field] = next;
  else delete out[field];
  return out as B;
}

export interface GraphNode {
  key: string;
  id: string;
  kind: string;
  name: string;
  /** referenced by an open piece but not open itself; `summary` is absent when the piece no longer exists */
  ghost: boolean;
  summary?: StudioEntitySummary;
}

export interface GraphEdge {
  id: string;
  from: string;
  field: RefField;
  to: string;
}

/** Open pieces as nodes, plus one ghost per referenced piece that is not open (shared targets stay one node). */
export function deriveGraph(
  open: readonly StudioEntitySummary[],
  bodies: Readonly<Record<string, unknown>>,
  lookup: (kind: string, id: string) => StudioEntitySummary | undefined,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = new Map<string, GraphNode>();
  for (const p of open) nodes.set(keyOf(p.id, p.kind), { key: keyOf(p.id, p.kind), id: p.id, kind: p.kind, name: p.name, ghost: false, summary: p });
  const edges: GraphEdge[] = [];
  for (const p of open) {
    const from = keyOf(p.id, p.kind);
    for (const port of portsOf(p.kind)) {
      for (const id of refsOf(bodies[from], port.field)) {
        const to = keyOf(id, port.to);
        if (!nodes.has(to)) {
          const summary = lookup(port.to, id);
          nodes.set(to, { key: to, id, kind: port.to, name: summary?.name ?? "Missing piece", ghost: true, ...(summary ? { summary } : {}) });
        }
        const edgeId = `${from}>${port.field}>${to}`;
        if (!edges.some((e) => e.id === edgeId)) edges.push({ id: edgeId, from, field: port.field, to });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}
