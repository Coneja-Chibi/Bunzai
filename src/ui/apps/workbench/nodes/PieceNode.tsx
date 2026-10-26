/**
 * One piece on the canvas: a kind-colored card with portrait or initial, name, a meta line and its
 * link ports (outgoing for characters, personas and presets; "Linked by" for what they point at).
 * A referenced piece that is not open renders faded, with a Bring up action.
 */
import { Button, Dot } from "../../../components/button";
import type { JSX, PointerEvent } from "react";
import type { CSSProperties } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { portraitUrl } from "../../../_shared/asset-url";
import { dirtyTitle } from "./link-write";
import { isTargetKind, portsOf, type GraphNode, type RefField } from "./links";
import css from "./nodes.module.css";

export function metaOf(node: GraphNode): string {
  if (node.ghost) return node.summary ? "not on the workbench" : "no longer in the library";
  const f: StudioEntitySummary["facts"] = node.summary?.facts;
  if (f?.lore) return `${f.lore.entryCount} entries`;
  if (f?.blocks !== undefined) return `${f.blocks} blocks`;
  if (f?.tokens !== undefined) return `~${f.tokens} tok`;
  return deckMeta(node.kind).singular;
}

export interface PieceNodeProps {
  node: GraphNode;
  at: readonly [number, number];
  selected: boolean;
  /** a wire is being dragged and this node would accept it */
  accepts: boolean;
  counts: Readonly<Partial<Record<RefField, number>>>;
  linkedBy: readonly string[];
  dirty: boolean;
  readOnly: boolean;
  onDown(e: PointerEvent): void;
  onOpen(): void;
  onPortDown(e: PointerEvent, field: RefField): void;
  onBringUp(): void;
}

export function PieceNode(p: PieceNodeProps): JSX.Element {
  const { node } = p;
  const meta = deckMeta(node.kind);
  const art = node.summary?.hasPortrait ? portraitUrl(node.kind, node.id) : null;
  const locked = p.dirty || p.readOnly;
  const cls = [css.node, p.selected && css.nodeSel, node.ghost && css.nodeGhost, p.accepts && css.nodeDrop].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      style={{ left: p.at[0], top: p.at[1], "--k": meta.accent } as CSSProperties}
      data-node={node.key}
      onPointerDown={p.onDown}
      onDoubleClick={p.onOpen}
    >
      <div className={css.hd}>
        <div className={css.pic} style={art ? { backgroundImage: `url("${art}")` } : undefined}>{!art && node.name.charAt(0).toUpperCase()}</div>
        <div className={css.hdText}>
          <div className={css.kind}>{meta.singular}</div>
          <div className={css.nm} title={node.name}>{node.name}</div>
        </div>
      </div>
      <div className={css.meta}>
        <span>{metaOf(node)}</span>
        {node.ghost && node.summary && (
          <Button size="sm" onPointerDown={(e) => e.stopPropagation()} onClick={p.onBringUp}>Bring up</Button>
        )}
      </div>
      {portsOf(node.kind).map((port) => {
        const count = p.counts[port.field] ?? 0;
        return (
          <div key={port.field} className={`${css.port} ${count ? css.full : ""}`} style={{ "--pc": deckMeta(port.to).accent } as CSSProperties}>
            <span>{port.label}</span>
            <small>{count}</small>
            <Dot
              kind="port"
              color={deckMeta(port.to).accent}
              label={`Link ${port.label} from ${node.name}`}
              disabled={locked}
              title={p.dirty ? dirtyTitle(node.name) : p.readOnly ? "Linking needs a wider window" : `Drag onto a ${deckMeta(port.to).singular.toLowerCase()} to link it`}
              onPointerDown={(e) => { e.stopPropagation(); p.onPortDown(e, port.field); }}
            />
          </div>
        );
      })}
      {isTargetKind(node.kind) && (
        <div className={`${css.port} ${css.inRow} ${p.linkedBy.length ? css.full : ""}`} style={{ "--pc": meta.accent } as CSSProperties}>
          <span>Linked by</span>
          <small title={p.linkedBy.join(", ")}>{p.linkedBy.length}</small>
        </div>
      )}
    </div>
  );
}
