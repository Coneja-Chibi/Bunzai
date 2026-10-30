/** Both board levels reuse the Workbench canvas and preset node; the book's phase and block data own every edit. */
import { useState, type JSX } from "react";
import type { BookPhase } from "../../../../entities/promptbook/schema";
import type { AppContext } from "../../../app-contract";
import { NodeCanvas, type Selection } from "../nodes/NodeCanvas";
import { useCanvasState } from "../nodes/use-canvas-state";
import { boundsOf, fitView, wirePath, type Pt } from "../nodes/geometry";
import { pipelineRows, pipeHeight, PIPE_W, reorderChangesBuild } from "../nodes/pipeline";
import { PipelineNode } from "../nodes/PipelineNode";
import { bulkSetEnabled, reorderBlock } from "../preset/session";
import { Button, Segmented } from "../../../components/button";
import s from "./promptbook.module.css";

export function BookBoard({ phases, selected, onSelect, onChange, ctx, bookId }: { phases: readonly BookPhase[]; selected: string; onSelect(id: string): void; onChange(p: BookPhase): void; ctx: AppContext; bookId: string }): JSX.Element {
  const [canvas, edit] = useCanvasState(ctx, `workbench.promptbook.${bookId}`);
  const [level, setLevel] = useState<"phases" | "blocks">("phases");
  const [size, setSize] = useState({ w: 800, h: 300 });
  const [selection, select] = useState<Selection>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const at = (id: string): Pt => canvas.pos[id] ?? (id.startsWith("blocks:") ? [32, 32] : [32 + phases.findIndex((p) => p.id === id) * 272, 48]);
  const phase = phases.find((p) => p.id === selected)!;
  const blockKey = `blocks:${selected}`;
  const summary = pipelineRows(phase.preset, { texts: {}, lore: null });
  const rects = level === "phases" ? phases.map((p) => ({ x: at(p.id)[0], y: at(p.id)[1], w: 224, h: 130 })) : [{ x: at(blockKey)[0], y: at(blockKey)[1], w: PIPE_W, h: pipeHeight(summary.blocks) }];
  return <><div className={s.toolbar}><Segmented label="Board level" value={level} onChange={setLevel} items={[{ value: "phases", label: "The book" }, { value: "blocks", label: "Inside this phase" }]} /><Button size="sm" onClick={() => edit((c) => ({ ...c, ...fitView(boundsOf(rects), size) }))}>Fit board</Button><small>Solid: phase order. Dashed: notes passed forward.</small></div>
    <div className={s.board} data-part="promptbook.board"><NodeCanvas nodes={[]} edges={[]} at={at} canvas={{ ...canvas, layers: { links: false, pipeline: true, board: false } }} edit={edit} readOnly={canvas.frozen} dirty={{}} selection={selection} select={select} editingId={editing} setEditingId={setEditing} size={size} onSize={setSize} onOpen={() => undefined} onBringUp={() => undefined} onLink={() => undefined} onUnlink={() => undefined} layerRects={rects}
      layer={(tools) => level === "blocks" ? <PipelineNode nodeKey={blockKey} name={phase.name} at={at(blockKey)} summary={summary} context={{ character: null, persona: null }} sceneName={null} dirty={false} dropRow={null} readOnly={false} onDown={(e) => tools.drag(e, blockKey)} onOpen={() => undefined} onToggle={(id, enabled) => onChange({ ...phase, preset: bulkSetEnabled(phase.preset, new Set([id]), enabled) })} onMove={(from, to) => { const preset = reorderBlock(phase.preset, from, to); if (reorderChangesBuild(phase.preset, preset)) onChange({ ...phase, preset }); else ctx.setStatus("Those blocks have different placement or order values; change their settings first."); }} /> : <>
        <svg className={s.wires} aria-hidden="true">{phases.slice(1).map(/* bounded-ok: spatial canvas order edges; one per authored phase */ (p, i) => { const from = at(phases[i]!.id); const to = at(p.id); return <path key={p.id} d={wirePath([from[0] + 224, from[1] + 60], [to[0], to[1] + 60])} />; })}{phases.flatMap((p) => p.reads.map((id) => { const from = at(id); const to = at(p.id); return <path key={`${id}:${p.id}`} strokeDasharray="5 5" d={wirePath([from[0] + 224, from[1] + 100], [to[0], to[1] + 100])} />; }))}</svg>
        {phases.map(/* bounded-ok: spatial canvas nodes, sharing geometry with its minimap */ (p, i) => <article key={p.id} className={s.boardPhase} style={{ left: at(p.id)[0], top: at(p.id)[1] }} onPointerDown={(e) => tools.drag(e, p.id)}><small>Phase {i + 1} · {p.role}</small><Button block aria-pressed={selected === p.id} onClick={() => onSelect(p.id)} title={p.name}><span className={s.phaseName}>{p.name}</span></Button><p>{p.cards.length} cards · {p.enabled ? "On" : "Off"}</p></article>)}
      </>} /></div>
  </>;
}
