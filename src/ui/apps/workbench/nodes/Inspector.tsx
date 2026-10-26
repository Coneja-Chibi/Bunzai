/**
 * The canvas inspector: facts and actions for the selected node, wire or board item. Unlinking and
 * every other write go through the callbacks; this component only presents them.
 */
import type { CSSProperties, JSX } from "react";
import { Stamp } from "../../../components/stamp";
import { deckMeta } from "../../../_shared/decks";
import { dirtyTitle } from "./link-write";
import { metaOf } from "./PieceNode";
import type { BoardItem } from "./canvas-state";
import type { GraphEdge, GraphNode } from "./links";
import css from "./nodes.module.css";

export interface InspectorProps {
  node: GraphNode | null;
  edge: GraphEdge | null;
  item: BoardItem | null;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  dirty: Readonly<Record<string, boolean>>;
  readOnly: boolean;
  onOpen(node: GraphNode): void;
  onBringUp(node: GraphNode): void;
  onUnlink(edge: GraphEdge): void;
  onItem(id: string, patch: Partial<BoardItem>): void;
  onRemove(id: string): void;
}

export function Inspector(p: InspectorProps): JSX.Element | null {
  const byKey = new Map(p.nodes.map((n) => [n.key, n] as const));
  const unlink = (edge: GraphEdge): JSX.Element => {
    const src = byKey.get(edge.from);
    const locked = p.readOnly || p.dirty[edge.from] === true;
    return (
      <Stamp key={edge.id} disabled={locked} title={p.dirty[edge.from] ? dirtyTitle(src?.name ?? "this piece") : undefined} onClick={() => p.onUnlink(edge)}>
        Unlink from {src?.name ?? "piece"}
      </Stamp>
    );
  };

  if (p.item) {
    const it = p.item;
    return (
      <aside className={css.insp} style={{ "--k": "var(--stage-warn)" } as CSSProperties}>
        <div className={css.inspHd}><div className={css.kind}>{it.type === "frame" ? "Frame" : it.type === "image" ? "Picture" : "Note"}</div></div>
        {it.type !== "image" && (
          <label className={css.inspRow}>
            <span>{it.type === "frame" ? "Label" : "Text"}</span>
            {it.type === "frame"
              ? <input value={it.text ?? ""} disabled={p.readOnly} onChange={(e) => p.onItem(it.id, { text: e.target.value })} />
              : <textarea value={it.text ?? ""} disabled={p.readOnly} rows={3} onChange={(e) => p.onItem(it.id, { text: e.target.value })} />}
          </label>
        )}
        {it.type === "note" && (
          <label className={css.inspRow}>
            <span>Pin to</span>
            <select value={it.pin ?? ""} disabled={p.readOnly} onChange={(e) => p.onItem(it.id, { pin: e.target.value || undefined })}>
              <option value="">Nothing</option>
              {p.nodes.filter((n) => !n.ghost).map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
            </select>
          </label>
        )}
        <div className={css.acts}><Stamp disabled={p.readOnly} onClick={() => p.onRemove(it.id)}>Remove</Stamp></div>
      </aside>
    );
  }

  if (p.edge) {
    const from = byKey.get(p.edge.from);
    const to = byKey.get(p.edge.to);
    return (
      <aside className={css.insp} style={{ "--k": deckMeta(to?.kind ?? "").accent } as CSSProperties}>
        <div className={css.inspHd}><div className={css.kind}>Link</div><div className={css.nm}>{from?.name} to {to?.name}</div></div>
        <div className={css.acts}>{unlink(p.edge)}</div>
      </aside>
    );
  }

  if (p.node) {
    const n = p.node;
    const incoming = p.edges.filter((e) => e.to === n.key);
    return (
      <aside className={css.insp} style={{ "--k": deckMeta(n.kind).accent } as CSSProperties}>
        <div className={css.inspHd}><div className={css.kind}>{deckMeta(n.kind).singular}</div><div className={css.nm}>{n.name}</div></div>
        <div className={css.inspRow}><span>Facts</span><b>{metaOf(n)}</b></div>
        {incoming.length > 0 && <div className={css.inspRow}><span>Linked by</span><b>{incoming.map((e) => byKey.get(e.from)?.name).join(", ")}</b></div>}
        <div className={css.acts}>
          {n.ghost
            ? n.summary && <Stamp accent="var(--accent-deep)" onClick={() => p.onBringUp(n)}>Bring up</Stamp>
            : <Stamp accent="var(--accent-deep)" onClick={() => p.onOpen(n)}>Open in Desk</Stamp>}
          {incoming.map(unlink)}
        </div>
      </aside>
    );
  }
  return null;
}
