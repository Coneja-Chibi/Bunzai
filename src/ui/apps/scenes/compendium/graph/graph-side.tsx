/**
 * The explorer's left column and node detail (RoleCall `GraphExploreModal.tsx:400-560,870-1020`): Find Entry, Entry Types, Connection
 * Types and Display toggles; and for the selected node its type chip, name, connection counts, who it connects to, and OPEN IN CODEX.
 * RoleCall's list stops at nine types; here all eleven are offered.
 */
import type { CSSProperties, JSX } from "react";
import { ENTRY_TYPE_INFO, type CrossRefNode, type EntryType } from "../../../../../core/compendium";
import { GLYPH } from "../compendium-core";
import { EDGE_KINDS, edgeKindOf, edgeLabel, type EdgeKind, type Filters } from "./graph-core";

/** RoleCall's labels and order, then the two it lacks. */
const TYPE_ROWS: readonly { type: EntryType; label: string }[] = [
  { type: "character", label: "Cast" }, { type: "location", label: "Places" }, { type: "item", label: "Items" }, { type: "organization", label: "Orgs" },
  { type: "event", label: "Events" }, { type: "plot", label: "Plots" }, { type: "threat", label: "Threats" }, { type: "worldbuilding", label: "Worldbuilding" },
  { type: "summary", label: "Summaries" }, { type: "power", label: "Powers" }, { type: "creature", label: "Creatures" },
];
const KIND = new Map(EDGE_KINDS.map((e) => [e.kind, e]));

function Toggle({ on, onClick, icon, label, count }: { on: boolean; onClick(): void; icon: JSX.Element; label: string; count?: number }): JSX.Element {
  return <button type="button" className={`ft${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}
const Group = ({ children }: { children: string }): JSX.Element => <div className="fg"><span aria-hidden="true">{GLYPH.star}</span>{children}</div>;
const flip = <T,>(set: ReadonlySet<T>, v: T): Set<T> => { const next = new Set(set); if (!next.delete(v)) next.add(v); return next; };

export interface SideProps {
  f: Filters;
  onF(next: Filters): void;
  counts: Readonly<Record<string, number>>;
  query: string;
  onQuery(q: string): void;
  hits: number;
  edgeLabels: boolean;
  onEdgeLabels(on: boolean): void;
}

export function GraphSide({ f, onF, counts, query, onQuery, hits, edgeLabels, onEdgeLabels }: SideProps): JSX.Element {
  return (
    <aside className="gx-side" aria-label="Graph filters" data-part="compendium.graph.side">
      <div>
        <Group>Find Entry</Group>
        <input value={query} placeholder="Search nodes..." aria-label="Find entry" onChange={(e) => onQuery(e.target.value)} />
        <div className="hint">{hits > 0 ? `${hits} match${hits === 1 ? "" : "es"}` : 'e.g. "gojo", "shibuya"'}</div>
      </div>
      <div>
        <Group>Entry Types</Group>
        {TYPE_ROWS.map((r) => (
          <Toggle key={r.type} on={f.types.has(r.type)} onClick={() => onF({ ...f, types: flip(f.types, r.type) })} label={r.label} count={counts[r.type] ?? 0}
            icon={<i className="dot" style={{ background: `var(${ENTRY_TYPE_INFO[r.type].token})` }} />} />
        ))}
      </div>
      <div>
        <Group>Connection Types</Group>
        {EDGE_KINDS.map((e) => (
          <Toggle key={e.kind} on={f.kinds.has(e.kind)} onClick={() => onF({ ...f, kinds: flip<EdgeKind>(f.kinds, e.kind) })} label={e.label}
            icon={<i className="sw" style={{ borderTop: `2px ${e.kind === "participant" ? "dotted" : e.dash ? "dashed" : "solid"} var(${e.token})` }} />} />
        ))}
      </div>
      <div>
        <Group>Display</Group>
        <Toggle on={f.orphans} onClick={() => onF({ ...f, orphans: !f.orphans })} label="Show orphaned nodes" icon={<i className="box" />} />
        <Toggle on={edgeLabels} onClick={() => onEdgeLabels(!edgeLabels)} label="Show edge labels" icon={<i className="box" />} />
      </div>
    </aside>
  );
}

export interface DetailProps {
  node: CrossRefNode;
  /** Every link the node has, whatever the filters say (RoleCall lists them all). */
  connections: readonly { other: CrossRefNode; edge: string }[];
  total: number;
  onPick(id: string): void;
  onOpen(): void;
}

export function GraphDetail({ node, connections, total, onPick, onOpen }: DetailProps): JSX.Element {
  const color = `var(${ENTRY_TYPE_INFO[node.type].token})`;
  return (
    <div className="gx-detail" style={{ "--tc": color } as CSSProperties} data-part="compendium.graph.detail">
      <div>
        <span className="chip">{GLYPH.star} {node.type}</span>
        <h4>{node.name}</h4>
      </div>
      <div className="rule" />
      <div className="stats">
        <div className="row"><span>Total connections</span><b>{total}</b></div>
        {EDGE_KINDS.map((k) => {
          const n = connections.filter((c) => edgeKindOf(c.edge) === k.kind).length;
          return n === 0 ? null : <div className="row" key={k.kind} style={{ "--ek": `var(${k.token})` } as CSSProperties}><span>{k.label}</span><b>{n}</b></div>;
        })}
      </div>
      <div className="rule" />
      <div className="conn">
        <div className="cap">Connected to</div>
        {connections.length === 0 && <p className="none">No visible connections.</p>}
        {connections.map((c, i) => (
          <button type="button" key={`${c.other.id}-${i}`} style={{ "--ek": `var(${KIND.get(edgeKindOf(c.edge))!.token})` } as CSSProperties} onClick={() => onPick(c.other.id)}>
            <i className="dot" />
            <span><b>{c.other.name}</b><small>{edgeLabel(c.edge)}</small></span>
          </button>
        ))}
      </div>
      <button type="button" className="open" onClick={onOpen}>OPEN IN CODEX {GLYPH.right}</button>
    </div>
  );
}
