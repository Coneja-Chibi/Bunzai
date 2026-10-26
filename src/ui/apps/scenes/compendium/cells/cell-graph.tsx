/**
 * The Dashboard's Cross-Reference Graph cell (RoleCall `BentoDashboard.tsx:1900-1927`): a small radial of the most referenced entry
 * and its neighbours, "N cross-references - tap to explore", and the explorer (graph/graph-explore.tsx) that any click on it opens.
 * Under 600px the radial gives way to RoleCall's VIEW CROSS-REFERENCES button. Opening an entry from the explorer closes it first.
 */
import { useState, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import { Button } from "../../../../components/button";
import type { BookModel } from "../compendium-core";
import { GLYPH, typeRole } from "../compendium-core";
import { GraphExploreModal } from "../graph/graph-explore";
import { Cell, Empty } from "./cell";

const R = 70;
const tc = (type: string): CSSProperties => ({ "--tc": typeRole(type) } as CSSProperties);

export function CrossRefCell({ m, onOpen }: { m: BookModel; onOpen(id: string): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const { nodes, edges } = m.graph;
  const center = [...nodes].sort((a, b) => b.refs - a.refs)[0];
  const spokes = new Map<string, (typeof nodes)[number]>();
  if (center) for (const e of edges) {
    const other = e.fromId === center.id ? e.toId : e.toId === center.id ? e.fromId : undefined;
    const node = other ? nodes.find((n) => n.id === other) : undefined;
    if (node && node.id !== center.id && spokes.size < 6) spokes.set(node.id, node);
  }
  const around = [...spokes.values()];
  const key = (e: KeyboardEvent): void => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } };
  return (
    <Cell title="Cross-Reference Graph">
      <div className="cp-gwrap" role="button" tabIndex={0} title="Open full cross-reference graph" onClick={() => setOpen(true)} onKeyDown={key}>
        {nodes.length === 0 ? <Empty>No cross-references yet.</Empty> : (
          <svg className="cp-graph" viewBox="-100 -90 200 180" role="img" aria-label="Most referenced entry and its neighbours">
            {around.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (n, i) => { const a = (i / around.length) * Math.PI * 2 - Math.PI / 2; return <line key={n.id} x1={0} y1={0} x2={Math.cos(a) * R} y2={Math.sin(a) * R} className="ed" />; })}
            {around.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (n, i) => { const a = (i / around.length) * Math.PI * 2 - Math.PI / 2; return <g key={n.id} transform={`translate(${Math.cos(a) * R} ${Math.sin(a) * R})`} style={tc(n.type)}><title>{n.name}</title><circle r={14} /><text y={4}>{n.name.slice(0, 3)}</text></g>; })}
            {center && <g style={tc(center.type)}><title>{center.name}</title><circle r={22} /><text y={4}>{center.name.slice(0, 4)}</text></g>}
          </svg>
        )}
        <div className="cp-gnote">{edges.length} cross-references {GLYPH.dot} tap to explore</div>
      </div>
      <div className="cp-gbtn"><Button block onClick={() => setOpen(true)}>VIEW CROSS-REFERENCES {edges.length} {GLYPH.right}</Button></div>
      {open && <GraphExploreModal m={m} onOpen={onOpen} onClose={() => setOpen(false)} />}
    </Cell>
  );
}
