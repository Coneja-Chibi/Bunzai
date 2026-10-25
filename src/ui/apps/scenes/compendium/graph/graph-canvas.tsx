/**
 * The explorer's drawing (RoleCall `GraphExploreModal.tsx:560-770`, a canvas there, SVG here so the theme's tokens paint it): links
 * with RoleCall's kind colours and dashes, nodes as a ring with initials and the name beneath, a halo on the selected or searched one,
 * and everything off the hovered or selected node's neighbourhood dimmed. The nodes and links are one memoised layer that does not
 * read the view, so a pan or a zoom only changes one transform and never redraws a node; a node being dragged is the one place
 * the layer redraws (`moved`). A node takes focus and Enter or Space selects it.
 */
import { memo, type JSX } from "react";
import type { CrossRefNode, EntryType } from "../../../../../core/compendium";
import { ENTRY_TYPE_INFO } from "../../../../../core/compendium";
import { initialsOf } from "../compendium-core";
import { EDGE_KINDS, edgeLabel, nodeSize, type GraphLayout, type Link } from "./graph-core";
import type { NodeDrag, Point } from "./use-node-drag";

const KIND = new Map(EDGE_KINDS.map((e) => [e.kind, e]));
const tokenOf = (type: EntryType): string => `var(${ENTRY_TYPE_INFO[type].token})`;

export interface LayerProps {
  nodes: readonly CrossRefNode[];
  links: readonly Link[];
  layout: GraphLayout;
  /** Where dragged nodes sit now, over the settled layout. */
  moved: ReadonlyMap<string, Point>;
  drag: NodeDrag;
  selected: string | null;
  /** The hovered or selected node and its neighbours; null lights everything. */
  lit: ReadonlySet<string> | null;
  hits: ReadonlySet<string>;
  /** Name labels under every node (RoleCall hides them when zoomed far out). */
  labels: boolean;
  edgeLabels: boolean;
  onPick(id: string): void;
  onHover(id: string | null): void;
}

export const GraphLayer = memo(function GraphLayer({ nodes, links, layout, moved, drag, selected, lit, hits, labels, edgeLabels, onPick, onHover }: LayerProps): JSX.Element {
  const at = (id: string): Point => moved.get(id) ?? layout.at.get(id)!;
  return (
    <>
      {links.map((l, i) => {
        const a = at(l.from);
        const b = at(l.to);
        const on = lit !== null && (lit.has(l.from) || lit.has(l.to));
        const kind = KIND.get(l.kind)!;
        return (
          <g key={i} className={`ln${on ? " on" : lit ? " dim" : ""}`} style={{ "--ek": `var(${kind.token})` } as React.CSSProperties}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...(kind.dash ? { strokeDasharray: kind.dash } : {})} />
            {on && edgeLabels && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6}>{edgeLabel(l.edge)}</text>}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = at(n.id);
        const size = nodeSize(n.refs);
        const r = size / 2;
        const isSel = selected === n.id;
        const show = labels || isSel || hits.has(n.id) || (lit?.has(n.id) ?? false);
        return (
          <g key={n.id} data-node={n.id} role="button" aria-label={`${n.name}, ${ENTRY_TYPE_INFO[n.type].label}`} aria-pressed={isSel}
            className={`gn${isSel ? " sel" : ""}${hits.has(n.id) ? " hit" : ""}${lit && !lit.has(n.id) ? " dim" : ""}`}
            style={{ "--tc": tokenOf(n.type) } as React.CSSProperties} transform={`translate(${p.x} ${p.y})`}
            tabIndex={0} onClick={() => { if (!drag.swallowClick()) onPick(n.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(n.id); } }}
            onPointerDown={(e) => drag.down(e, n.id)} onPointerMove={(e) => drag.move(e, n.id)} onPointerUp={(e) => drag.up(e, n.id)} onPointerOver={() => onHover(n.id)} onPointerOut={() => onHover(null)}>
            {(isSel || hits.has(n.id)) && <circle className="halo" r={r + 4} />}
            <circle className="body" r={r} />
            {isSel && <circle className="ring" r={r + 6} />}
            <text className="ini" y={4}>{initialsOf(n.name, size >= 38 ? 3 : 2)}</text>
            {show && <text className="nm" y={r + 14}>{n.name.toUpperCase()}</text>}
          </g>
        );
      })}
    </>
  );
});
