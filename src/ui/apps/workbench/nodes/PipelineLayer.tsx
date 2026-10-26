/**
 * The Pipeline layer drawn: each preset opened into its blocks, the Lore pass and the Request, and
 * the derived wires between them (solid: a piece or step feeding a slot; dashed: a lorebook feeding the
 * lore pass). The wires are not editable; they follow the context the data hook picked.
 */
import type { JSX, PointerEvent } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { keyOf } from "../../../_shared/piece-key";
import { LoreNode, RequestNode } from "./EngineNodes";
import { PipelineNode } from "./PipelineNode";
import { headAnchor, outAnchor, wirePath, type Pt } from "./geometry";
import type { GraphNode } from "./links";
import {
  LORE_H, LORE_KEY, REQUEST_H, REQUEST_KEY, blockInAnchor, engineIn, engineOut, markerWires, pipeKey, pipeOutAnchor,
  type PipelineModel,
} from "./pipeline";
import type { PipelineData } from "./use-pipeline";
import css from "./nodes.module.css";

export interface PipelineLayerProps {
  model: PipelineModel;
  data: PipelineData;
  /** the piece nodes (for wire sources); only drawn as sources while the Links layer shows them */
  nodes: readonly GraphNode[];
  piecesShown: boolean;
  at(key: string): Pt;
  dirty: Readonly<Record<string, boolean>>;
  readOnly: boolean;
  drag(e: PointerEvent, key: string): void;
  onToggle(piece: StudioEntitySummary, blockId: string, enabled: boolean): void;
  /** `seen` is the build order as drawn, so a preset changed underneath is not edited blind */
  onMove(piece: StudioEntitySummary, fromId: string, toId: string, seen: readonly string[]): void;
  onOpen(piece: StudioEntitySummary): void;
  /** pick which preset on the canvas the request is built from (no scene picked) */
  onPreset(id: string): void;
}

export function PipelineLayer(p: PipelineLayerProps): JSX.Element | null {
  const { model, data } = p;
  if (model.presets.length === 0) return null;
  const shown = new Set(p.piecesShown ? p.nodes.filter((n) => !n.ghost).map((n) => n.key) : []);
  const loreAt = p.at(LORE_KEY);
  const requestAt = p.at(REQUEST_KEY);
  const wires: { id: string; d: string; color: string; dashed: boolean }[] = [];
  for (const preset of model.presets) {
    const to = p.at(pipeKey(preset.key));
    for (const w of markerWires(preset.key, preset.summary.rows, data.context, shown)) {
      const from = w.from === LORE_KEY ? engineOut(loreAt, LORE_H) : headAnchor(p.at(w.from));
      wires.push({ id: w.id, d: wirePath(from, blockInAnchor(to, w.block)), color: w.color, dashed: w.dashed });
    }
  }
  if (model.active) {
    wires.push({ id: "out", d: wirePath(pipeOutAnchor(p.at(pipeKey(model.active.key)), model.active.summary.blocks), engineIn(requestAt, REQUEST_H)), color: "var(--deck-preset)", dashed: false });
  }
  for (const node of p.nodes) {
    if (node.kind === "lorebook" && !node.ghost && shown.has(node.key) && data.loreIds.includes(node.id)) {
      wires.push({ id: `${node.key}>lore`, d: wirePath(outAnchor(p.at(node.key), 0), engineIn(loreAt, LORE_H)), color: "var(--deck-lorebook)", dashed: true });
    }
  }

  return (
    <>
      <svg className={css.wires} data-part="nodes.pipeline-wires">
        {wires.map((w) => (
          <path key={w.id} className={css.wire} data-pipe-wire={w.id} d={w.d} style={{ stroke: w.color, ...(w.dashed ? { strokeDasharray: "5 4" } : {}) }} />
        ))}
      </svg>
      <LoreNode at={loreAt} stats={data.lore} hasContext={data.context.character !== null || data.context.persona !== null} onDown={(e) => p.drag(e, LORE_KEY)} />
      {model.presets.map((preset) => {
        const key = pipeKey(preset.key);
        return (
          <PipelineNode
            key={key}
            nodeKey={key}
            name={preset.piece.name}
            at={p.at(key)}
            summary={preset.summary}
            context={data.context}
            sceneName={data.scene?.title ?? null}
            dirty={p.dirty[keyOf(preset.piece.id, preset.piece.kind)] === true}
            readOnly={p.readOnly}
            onDown={(e) => p.drag(e, key)}
            onOpen={() => p.onOpen(preset.piece)}
            onToggle={(id, enabled) => p.onToggle(preset.piece, id, enabled)}
            onMove={(from, to) => p.onMove(preset.piece, from, to, preset.summary.rows.map((r) => r.id))}
          />
        );
      })}
      <RequestNode at={requestAt} view={model.request} scenes={data.scenes} sceneId={data.scene?.id ?? null} onScene={data.setSceneId} presets={data.scene?.preset ? [] : p.model.presets.map((m) => ({ id: m.piece.id, name: m.piece.name }))} presetId={p.model.active?.piece.id ?? null} onPreset={p.onPreset} onDown={(e) => p.drag(e, REQUEST_KEY)} />
    </>
  );
}
