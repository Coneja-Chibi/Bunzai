/**
 * The Workbench's Nodes view: the open pieces as nodes wired by their stored references, a board of
 * notes and frames, and the head row (view switch, layers, Add, Tidy up, Fit). Positions, zoom and the
 * board persist in ctx.prefs; links are written through link-write.ts, never from here directly.
 */
import { Button, Chip } from "../../../components/button";
import { useMemo, useRef, useState, useEffect } from "react";
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { AddMenu, newBoardItem } from "./Board";
import { Inspector } from "./Inspector";
import { NodeCanvas, type Selection, type Size } from "./NodeCanvas";
import { PipelineLayer } from "./PipelineLayer";
import { ViewSwitch } from "./ViewSwitch";
import { applyDrag, snapshotDrag, tidy, type CanvasState, type View } from "./canvas-state";
import { keyOf } from "../../../_shared/piece-key";
import { boundsOf, fitView, nodeRect, type Pt, type Rect } from "./geometry";
import { writeLink } from "./link-write";
import type { GraphEdge, GraphNode, RefField } from "./links";
import { ENGINE_W, FEATURE_H, LORE_H, LORE_KEY, PIPE_W, REQUEST_H, REQUEST_KEY, featureKey, featureWire, pipeHeight, pipeKey, pipelineModel, type PipelineModel } from "./pipeline";
import { FEATURE_MARKER_SLOTS, type FeatureMarkerSlot } from "../../../../core/preset";
import { writePreset, type BlockEdit } from "./preset-write";
import { usePipeline } from "./use-pipeline";
import { useCanvasState } from "./use-canvas-state";
import { useGraph } from "./use-graph";
import css from "./nodes.module.css";

const READ_ONLY_BELOW = 768;
const LAYERS = [
  ["links", "Links", "var(--deck-character)"],
  ["pipeline", "Pipeline", "var(--deck-preset)"],
  ["board", "Board", "var(--stage-warn)"],
] as const;

export function NodesView({ ctx, pieces, onView }: { ctx: AppContext; pieces: readonly StudioEntitySummary[]; onView(view: View): void }): JSX.Element {
  const { graph, bodies, reload } = useGraph(ctx, pieces);
  const [canvas, edit] = useCanvasState(ctx);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [selection, select] = useState<Selection>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [chosenPresetId, setChosenPresetId] = useState<string | undefined>(undefined);
  const [showFeaturePlacements, setShowFeaturePlacements] = useState(false);
  const readOnly = size.w > 0 && size.w < READ_ONLY_BELOW;
  const layout = useMemo(() => tidy(graph.nodes, graph.edges), [graph]);
  const presetPieces = pieces.filter((p) => p.kind === "preset");
  const presetBodies = useStable(presetPieces.map((p) => bodies[keyOf(p.id, p.kind)]));
  const pipelineOn = canvas.layers.pipeline && presetPieces.length > 0;
  const data = usePipeline(ctx, pieces, bodies, presetBodies, pipelineOn);
  const model = useMemo(
    () => pipelineModel({
      presets: presetPieces.map((piece, i) => ({ piece, body: presetBodies[i] })),
      scenePresetId: data.scene?.preset?.kind === "preset" ? data.scene.preset.id : undefined,
      chosenPresetId,
      sources: { texts: data.texts, lore: data.lore },
      hasScene: data.scene !== null,
      forecast: data.forecast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presetBodies, chosenPresetId, data.scene, data.texts, data.lore, data.forecast],
  );
  const featureSlots = FEATURE_MARKER_SLOTS.filter((slot) => showFeaturePlacements || model.presets.some((p) => p.summary.rows.some((row) => row.fills === slot)));
  const at = (key: string): Pt => canvas.pos[key] ?? layout[key] ?? model.defaults[key] ?? [40, 60];
  // A node keeps the place it first appeared at: pin unplaced nodes once, so opening another piece (which
  // changes the tidy layout) never moves nodes that were not dragged. Tidy up still lays everything out again.
  useEffect(() => {
    if (readOnly) return;
    const unplaced = graph.nodes.filter((n) => !canvas.pos[n.key] && layout[n.key]);
    if (unplaced.length === 0) return;
    edit((st) => ({ ...st, pos: { ...st.pos, ...Object.fromEntries(unplaced.map((n) => [n.key, layout[n.key]!] as const)) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layout, readOnly]);
  const byKey = new Map(graph.nodes.map((n) => [n.key, n] as const));
  const dirty = ctx.workbench.dirty();

  const bringUp = (node: GraphNode): void => { if (node.summary) ctx.workbench.send(node.summary); };
  const openInDesk = (node: GraphNode): void => {
    if (node.ghost) return bringUp(node);
    ctx.workbench.focus(node.id, node.kind);
    onView("desk");
  };

  const write = async (fromKey: string, field: RefField, toKey: string, on: boolean): Promise<void> => {
    const from = byKey.get(fromKey)?.summary;
    const to = byKey.get(toKey);
    if (!from || !to) return;
    const result = await writeLink(ctx, from, field, { id: to.id, kind: to.kind }, on);
    if (result !== "busy") reload();
  };
  const writeBlock = async (piece: StudioEntitySummary, edit: BlockEdit): Promise<void> => {
    if ((await writePreset(ctx, piece, edit)) !== "busy") reload();
  };
  const openPiece = (piece: StudioEntitySummary): void => { ctx.workbench.focus(piece.id, piece.kind); onView("desk"); };
  const layerRects = pipelineRects(model, at, featureSlots);
  const unlink = (edge: GraphEdge): void => { select(null); void write(edge.from, edge.field, edge.to, false); };
  /** Delete on a selected feature wire: the feature leaves that preset's marker for its own spot (the marker is switched off). */
  const ownSpot = (id: string): void => {
    const wire = featureWire(id);
    const preset = wire?.presetKey ? model.presets.find((m) => m.key === wire.presetKey) : undefined;
    if (!wire || !preset) return;
    select(null);
    void writeBlock(preset.piece, { t: "unplace", slot: wire.slot, seen: preset.summary.rows.map((r) => r.id) });
  };

  const fit = (): void => {
    const rects: Rect[] = [
      ...(canvas.layers.links ? graph.nodes.map((n) => nodeRect(n.kind, at(n.key))) : []),
      ...(canvas.layers.pipeline ? layerRects : []),
      ...(canvas.layers.board ? canvas.board : []),
    ];
    const next = fitView(boundsOf(rects), size.w ? size : { w: 800, h: 560 });
    edit((s) => ({ ...s, zoom: next.zoom, pan: next.pan }));
  };
  const tidyUp = (): void => edit((s) => {
    const spots = { ...model.defaults, ...layout };
    const keys = [...graph.nodes.map((n) => n.key), ...(pipelineOn ? Object.keys(model.defaults) : [])];
    return keys.reduce((acc: CanvasState, key) => {
      const old = acc.pos[key] ?? spots[key]!;
      const target = spots[key]!;
      return applyDrag(acc, snapshotDrag(acc, () => old, [key], []), target[0] - old[0], target[1] - old[1]);
    }, s);
  });
  const add = (type: "note" | "frame"): void => {
    const item = newBoardItem(type, [(size.w / 2 - canvas.pan[0]) / canvas.zoom, (size.h / 2 - canvas.pan[1]) / canvas.zoom]);
    edit((s) => ({ ...s, layers: { ...s.layers, board: true }, board: [...s.board, item] }));
    select({ t: "item", id: item.id });
    if (type === "note") setEditingId(item.id);
  };

  const empty = graph.nodes.length === 0 && canvas.board.length === 0;
  const picked = selection?.t === "node" ? byKey.get(selection.key) ?? null : null;
  const edge = selection?.t === "wire" ? graph.edges.find((e) => e.id === selection.id) ?? null : null;
  const item = selection?.t === "item" ? canvas.board.find((i) => i.id === selection.id) ?? null : null;

  return (
    <div className={css.view} data-part="nodes.root">
      <div className={css.head}>
        <ViewSwitch view="nodes" onChange={onView} />
        {LAYERS.map(([id, label, color]) => (
          <Chip
            key={id}
            pressed={canvas.layers[id]}
            onClick={() => edit((s) => ({ ...s, layers: { ...s.layers, [id]: !s.layers[id] } }))}
            color={color}
          >
            <i style={{ background: color }} />{label}
          </Chip>
        ))}
        {pipelineOn && <Chip pressed={showFeaturePlacements} onClick={() => setShowFeaturePlacements((show) => !show)} color="var(--deck-preset)">Feature placements</Chip>}
        <span className={css.grow} />
        <AddMenu disabled={readOnly} onAdd={add} />
        <Button size="sm" disabled={readOnly || !canvas.layers.links} onClick={tidyUp}>Tidy up</Button>
        <Button size="sm" onClick={fit}>Fit</Button>
      </div>
      <div className={css.area}>
        <NodeCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          at={at}
          canvas={canvas}
          edit={edit}
          readOnly={readOnly}
          dirty={dirty}
          selection={selection}
          select={select}
          editingId={editingId}
          setEditingId={setEditingId}
          size={size}
          onSize={setSize}
          onOpen={openInDesk}
          onBringUp={bringUp}
          onLink={(from, field, to) => void write(from.key, field, to.key, true)}
          onUnlink={unlink}
          layerRects={layerRects}
          onDeleteWire={ownSpot}
          layer={(tools) => (
            <PipelineLayer
              tools={tools}
              onPreset={setChosenPresetId}
              model={model}
              featureSlots={featureSlots}
              data={data}
              nodes={graph.nodes}
              piecesShown={canvas.layers.links}
              at={at}
              dirty={dirty}
              readOnly={readOnly}
              onToggle={(piece, id, enabled) => void writeBlock(piece, { t: "set", id, enabled })}
              onMove={(piece, from, to, seen) => void writeBlock(piece, { t: "move", from, to, seen })}
              onPlace={(piece, slot, to, seen) => void writeBlock(piece, { t: "place", slot, to, seen })}
              onOpen={openPiece}
            />
          )}
        />
        <Inspector
          node={picked}
          edge={edge}
          item={item}
          nodes={graph.nodes}
          edges={graph.edges}
          dirty={dirty}
          readOnly={readOnly}
          onOpen={openInDesk}
          onBringUp={bringUp}
          onUnlink={unlink}
          onItem={(id, patch) => edit((s) => ({ ...s, board: s.board.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))}
          onRemove={(id) => { select(null); edit((s) => ({ ...s, board: s.board.filter((i) => i.id !== id) })); }}
        />
        {empty && (
          <div className={css.empty}>
            <div>
              <h3>Nothing on the canvas yet</h3>
              <p>Bring pieces up from the Library. Their links draw themselves. Notes and frames go on the board with Add.</p>
              <Button variant="primary" onClick={() => ctx.openApp("library")}>Open the Library</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The same array while every element is unchanged, so effects keyed on it do not rerun on unrelated reads. */
function useStable<T>(next: readonly T[]): readonly T[] {
  const last = useRef(next);
  if (last.current.length !== next.length || last.current.some((v, i) => v !== next[i])) last.current = next;
  return last.current;
}

/** The Pipeline layer's rectangles: each expanded preset, the Lore pass, the feature nodes and the Request. */
function pipelineRects(model: PipelineModel, at: (key: string) => Pt, featureSlots: readonly FeatureMarkerSlot[]): Rect[] {
  if (model.presets.length === 0) return [];
  const box = (key: string, w: number, h: number): Rect => { const [x, y] = at(key); return { x, y, w, h }; };
  return [
    box(LORE_KEY, ENGINE_W, LORE_H),
    ...model.presets.map((p) => box(pipeKey(p.key), PIPE_W, pipeHeight(p.summary.blocks))),
    ...featureSlots.map((slot) => box(featureKey(slot), ENGINE_W, FEATURE_H)),
    box(REQUEST_KEY, ENGINE_W, REQUEST_H),
  ];
}
