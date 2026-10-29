/**
 * The Pipeline layer drawn: each preset opened into its blocks, the Lore pass and the Request, and
 * the derived wires between them (solid: a piece or step feeding a slot; dashed: a lorebook feeding the
 * lore pass). Those wires follow the context the data hook picked. Each feature node wires to its marker's block
 * (dashed to the Request when it keeps its own spot); dropping it on a block places its marker there.
 */
import { useRef } from "react";
import type { JSX, PointerEvent } from "react";
import { FEATURE_MARKER_SLOTS, type FeatureMarkerSlot } from "../../../../core/preset";
import type { StudioEntitySummary } from "../../../app-contract";
import { keyOf } from "../../../_shared/piece-key";
import { FeatureNode, LoreNode, RequestNode } from "./EngineNodes";
import { PipelineNode } from "./PipelineNode";
import { headAnchor, outAnchor, wirePath, type Pt } from "./geometry";
import type { GraphNode } from "./links";
import {
  FEATURE_H, LORE_H, LORE_KEY, REQUEST_H, REQUEST_KEY, blockInAnchor, engineIn, engineOut, featureColor, featureKey, featureRows, markerWires, pipeKey, pipeOutAnchor,
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
  /** put a feature's marker on a block of this preset (adding it when the preset has none) */
  onPlace(piece: StudioEntitySummary, slot: FeatureMarkerSlot, toId: string, seen: readonly string[]): void;
  /** take a feature's marker out of the request's preset, so the feature keeps its own spot */
  onOwnSpot(piece: StudioEntitySummary, slot: FeatureMarkerSlot, seen: readonly string[]): void;
  onOpen(piece: StudioEntitySummary): void;
  /** pick which preset on the canvas the request is built from (no scene picked) */
  onPreset(id: string): void;
}

export function PipelineLayer(p: PipelineLayerProps): JSX.Element | null {
  const { model, data } = p;
  const featureDrag = useRef<FeatureMarkerSlot | null>(null);
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
  for (const preset of model.presets) {
    const to = p.at(pipeKey(preset.key));
    const placed = featureRows(preset.summary.rows);
    for (const slot of FEATURE_MARKER_SLOTS) {
      const row = placed[slot];
      const from = engineOut(p.at(featureKey(slot)), FEATURE_H);
      if (row !== null) wires.push({ id: `${slot}>${preset.key}`, d: wirePath(from, blockInAnchor(to, row)), color: featureColor(slot), dashed: false });
      else if (preset === model.active) wires.push({ id: `${slot}>request`, d: wirePath(from, engineIn(requestAt, REQUEST_H)), color: featureColor(slot), dashed: true });
    }
  }
  const active = model.active;
  const activePlaced = active ? featureRows(active.summary.rows) : null;
  const activeLocked = !active || p.readOnly || p.dirty[keyOf(active.piece.id, active.piece.kind)] === true;
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
      {FEATURE_MARKER_SLOTS.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (slot) => {
        const row = activePlaced?.[slot] ?? null;
        return (
          <FeatureNode
            key={slot}
            slot={slot}
            at={p.at(featureKey(slot))}
            placedAt={row !== null && active ? `${active.summary.rows[row]!.name} in ${active.piece.name}` : null}
            locked={activeLocked}
            onDown={(e) => p.drag(e, featureKey(slot))}
            onDrag={(s) => { featureDrag.current = s; }}
            onOwnSpot={() => { if (active) p.onOwnSpot(active.piece, slot, active.summary.rows.map((r) => r.id)); }}
          />
        );
      })}
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
            feature={() => featureDrag.current}
            onPlace={(slot, to) => { featureDrag.current = null; p.onPlace(preset.piece, slot, to, preset.summary.rows.map((r) => r.id)); }}
          />
        );
      })}
      <RequestNode at={requestAt} view={model.request} scenes={data.scenes} sceneId={data.scene?.id ?? null} onScene={data.setSceneId} presets={data.scene?.preset ? [] : p.model.presets.map((m) => ({ id: m.piece.id, name: m.piece.name }))} presetId={p.model.active?.piece.id ?? null} onPreset={p.onPreset} onDown={(e) => p.drag(e, REQUEST_KEY)} />
    </>
  );
}
