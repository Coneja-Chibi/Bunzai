/**
 * The Pipeline layer drawn: each preset opened into its blocks, the Lore pass and the Request, and
 * the derived wires between them (solid: a piece or step feeding a slot; dashed: a lorebook feeding the
 * lore pass). Those wires follow the context the data hook picked. Each feature node wires to its marker's block
 * only when the preset actually has a marker; available placement controls are shown on demand. A feature's port draws a wire with the canvas's own wire drag, and
 * a release on a block places its marker there; its wire selects and deletes like a link, which is Own spot.
 */
import type { JSX } from "react";
import type { FeatureMarkerSlot } from "../../../../core/preset";
import type { LayerTools } from "./NodeCanvas";
import type { StudioEntitySummary } from "../../../app-contract";
import { keyOf } from "../../../_shared/piece-key";
import { FeatureNode, LoreNode, RequestNode } from "./EngineNodes";
import { PipelineNode } from "./PipelineNode";
import { headAnchor, outAnchor, wirePath, type Pt } from "./geometry";
import type { GraphNode } from "./links";
import {
  LORE_H, LORE_KEY, REQUEST_H, REQUEST_KEY, blockInAnchor, blockUnder, engineIn, engineOut, featureColor, featureKey, featureOut, featureRows, featureWireId,
  markerWires, pipeKey, pipeOutAnchor,
  type PipelineModel,
} from "./pipeline";
import type { PipelineData } from "./use-pipeline";
import css from "./nodes.module.css";

export interface PipelineLayerProps {
  model: PipelineModel;
  featureSlots: readonly FeatureMarkerSlot[];
  data: PipelineData;
  /** the piece nodes (for wire sources); only drawn as sources while the Links layer shows them */
  nodes: readonly GraphNode[];
  piecesShown: boolean;
  at(key: string): Pt;
  dirty: Readonly<Record<string, boolean>>;
  readOnly: boolean;
  tools: LayerTools;
  onToggle(piece: StudioEntitySummary, blockId: string, enabled: boolean): void;
  /** `seen` is the build order as drawn, so a preset changed underneath is not edited blind */
  onMove(piece: StudioEntitySummary, fromId: string, toId: string, seen: readonly string[]): void;
  /** put a feature's marker on a block of this preset (adding it when the preset has none) */
  onPlace(piece: StudioEntitySummary, slot: FeatureMarkerSlot, toId: string, seen: readonly string[]): void;
  onOpen(piece: StudioEntitySummary): void;
  /** pick which preset on the canvas the request is built from (no scene picked) */
  onPreset(id: string): void;
}

export function PipelineLayer(p: PipelineLayerProps): JSX.Element | null {
  const { model, data } = p;
  if (model.presets.length === 0) return null;
  const { tools } = p;
  const shown = new Set(p.piecesShown ? p.nodes.filter((n) => !n.ghost).map((n) => n.key) : []);
  const loreAt = p.at(LORE_KEY);
  const requestAt = p.at(REQUEST_KEY);
  const wires: { id: string; d: string; color: string; dashed: boolean; selectable?: boolean }[] = [];
  for (const preset of model.presets) {
    const to = p.at(pipeKey(preset.key));
    for (const w of markerWires(preset.key, preset.summary.rows, data.context, shown)) {
      const from = w.from === LORE_KEY ? engineOut(loreAt, LORE_H) : headAnchor(p.at(w.from));
      wires.push({ id: w.id, d: wirePath(from, blockInAnchor(to, w.block)), color: w.color, dashed: w.dashed });
    }
  }
  const placements = model.presets.map((preset) => ({ preset, rows: featureRows(preset.summary.rows) }));
  for (const { preset, rows: placed } of placements) {
    const to = p.at(pipeKey(preset.key));
    for (const slot of p.featureSlots) {
      const row = placed[slot];
      const from = featureOut(p.at(featureKey(slot)));
      if (row !== null) wires.push({ id: featureWireId(slot, preset.key), d: wirePath(from, blockInAnchor(to, row)), color: featureColor(slot), dashed: false, selectable: true });
    }
  }
  const targets = model.presets.map((m) => ({ key: m.key, at: p.at(pipeKey(m.key)), blocks: m.summary.rows.length }));
  /** A feature wire released on a block row places that feature's marker there (the topmost preset under it). */
  const dropFeature = (slot: FeatureMarkerSlot, pt: Pt): void => {
    const hit = blockUnder(targets, pt);
    const preset = hit && model.presets.find((m) => m.key === hit.key);
    // a preset with unsaved Desk edits is refused by the write itself, which says so (link-write.ts)
    if (hit && preset) p.onPlace(preset.piece, slot, preset.summary.rows[hit.row]!.id, preset.summary.rows.map((r) => r.id));
  };
  const lit = tools.wireAt ? blockUnder(targets, tools.wireAt) : null;
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
        {wires.map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (w) => (
          <g key={w.id} data-pipe-wire={w.id}>
            {w.selectable && <path className={css.wireHit} d={w.d} onPointerDown={(e) => { e.stopPropagation(); tools.selectWire(w.id); }} />}
            <path className={`${css.wire}${tools.selectedWire === w.id ? ` ${css.wireSel}` : ""}`} d={w.d} style={{ stroke: w.color, ...(w.dashed ? { strokeDasharray: "5 4" } : {}) }} />
          </g>
        ))}
      </svg>
      {p.featureSlots.map(/* bounded-ok: four placement controls from the feature slot registry */ (slot) => {
        const placedAt = placements.flatMap(({ preset, rows }) => rows[slot] === null ? [] : [`${preset.summary.rows[rows[slot]]!.name} in ${preset.piece.name}`]).join(", ");
        return (
          <FeatureNode
            key={slot}
            slot={slot}
            at={p.at(featureKey(slot))}
            placedAt={placedAt || null}
            locked={p.readOnly ? "Editing needs a wider window" : null}
            onDown={(e) => tools.drag(e, featureKey(slot))}
            onPortDown={(e) => tools.wire(e, featureOut(p.at(featureKey(slot))), (pt) => dropFeature(slot, pt))}
          />
        );
      })}
      <LoreNode at={loreAt} stats={data.lore} hasContext={data.context.character !== null || data.context.persona !== null} onDown={(e) => tools.drag(e, LORE_KEY)} />
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
            dropRow={lit?.key === preset.key ? lit.row : null}
            readOnly={p.readOnly}
            onDown={(e) => tools.drag(e, key)}
            onOpen={() => p.onOpen(preset.piece)}
            onToggle={(id, enabled) => p.onToggle(preset.piece, id, enabled)}
            onMove={(from, to) => p.onMove(preset.piece, from, to, preset.summary.rows.map((r) => r.id))}
          />
        );
      })}
      <RequestNode at={requestAt} view={model.request} scenes={data.scenes} sceneId={data.scene?.id ?? null} onScene={data.setSceneId} presets={data.scene?.preset ? [] : p.model.presets.map((m) => ({ id: m.piece.id, name: m.piece.name }))} presetId={p.model.active?.piece.id ?? null} onPreset={p.onPreset} onDown={(e) => tools.drag(e, REQUEST_KEY)} />
    </>
  );
}
