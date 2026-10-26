/**
 * A preset opened up into its blocks in build order. Click a block to switch it on or off, drag one
 * onto another to move it; both are single preset writes made by the caller. Marker blocks are inputs
 * (a port dot in the source's color); off blocks are struck through.
 */
import { ListRow } from "../../../components/button";
import { useRef } from "react";
import type { CSSProperties, JSX, PointerEvent } from "react";
import { dirtyTitle } from "./link-write";
import { BLOCK_H, PIPE_FOOT_H, PIPE_HEAD_H, PIPE_W, ownerColor, tokLabel, type PipelineContext, type PipelineRow, type PipelineSummary } from "./pipeline";
import css from "./nodes.module.css";

export interface PipelineNodeProps {
  nodeKey: string;
  name: string;
  at: readonly [number, number];
  summary: PipelineSummary;
  context: PipelineContext;
  /** the picked scene's title, which feeds chat history */
  sceneName: string | null;
  dirty: boolean;
  readOnly: boolean;
  onDown(e: PointerEvent): void;
  onOpen(): void;
  /** switch a block to the state its button offers (the opposite of what is shown) */
  onToggle(blockId: string, enabled: boolean): void;
  onMove(fromId: string, toId: string): void;
}

function sourceOf(row: PipelineRow, context: PipelineContext, sceneName: string | null): string {
  switch (row.owner) {
    case "character": return context.character?.name ?? "no character";
    case "persona": return context.persona?.name ?? "no persona";
    case "lore": return "Lore pass";
    case "scene": return sceneName ?? "sample history";
    default: return "";
  }
}

export function PipelineNode(p: PipelineNodeProps): JSX.Element {
  const drag = useRef<string | null>(null);
  const locked = p.dirty || p.readOnly;
  const why = p.dirty ? dirtyTitle(p.name) : p.readOnly ? "Editing needs a wider window" : null;
  return (
    <div
      className={css.pipe}
      style={{ left: p.at[0], top: p.at[1], width: PIPE_W, "--k": "var(--deck-preset)" } as CSSProperties}
      data-pipe={p.nodeKey}
      onPointerDown={p.onDown}
      onDoubleClick={p.onOpen}
    >
      <div className={css.pipeHd} style={{ height: PIPE_HEAD_H - 3 }}>
        <div className={css.kind}>Preset</div>
        <div className={css.pipeName} title={p.name}>{p.name}</div>
      </div>
      {p.summary.rows.length === 0 && <div className={css.blk} style={{ height: BLOCK_H }}><span /><span>No blocks yet</span></div>}
      {p.summary.rows.map((row, i) => {
        const color = row.owner ? ownerColor(row.owner) : undefined;
        const src = row.marker ? sourceOf(row, p.context, p.sceneName) : "";
        return (
          <div
            key={`${row.id}:${i}`}
            className={[css.blk, row.marker && css.mark, !row.on && css.off].filter(Boolean).join(" ")}
            style={{ height: BLOCK_H, ...(color ? { "--pc": color } : {}) } as CSSProperties}
            data-block={row.id}
            data-on={row.on}
            data-source={src || undefined}
            title={row.marker && src ? `${row.name}: fed by ${src}` : undefined}
            draggable={!locked}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => { drag.current = row.id; e.dataTransfer?.setData("text/plain", row.id); }}
            onDragEnd={() => { drag.current = null; }}
            onDragOver={(e) => { if (!locked) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const from = drag.current;
              drag.current = null;
              if (!locked && from && from !== row.id) p.onMove(from, row.id);
            }}
          >
            <span className={css.grip} aria-hidden="true">::</span>
            <ListRow
              aria-pressed={row.on}
              disabled={locked}
              title={why ?? (row.on ? "Click to switch off" : "Click to switch on")}
              onClick={() => p.onToggle(row.id, !row.on)}
              label={<>{row.name}{src && <em> · {src}</em>}</>}
            />
            <small>{row.tokens === null ? "slot" : tokLabel(row.tokens)}</small>
          </div>
        );
      })}
      <div className={css.pipeFt} style={{ height: PIPE_FOOT_H }}>
        <span>{p.summary.blocks} block{p.summary.blocks === 1 ? "" : "s"}{p.summary.off ? ` · ${p.summary.off} off` : ""}</span>
        <span>{tokLabel(p.summary.tokens)} tok</span>
      </div>
    </div>
  );
}
