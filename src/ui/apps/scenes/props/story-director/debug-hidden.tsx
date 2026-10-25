/**
 * The Debug tab's hidden arcs and notes (RoleCall's ShadowWorldSection and InvisibleArcForm, StoryDirectorWingPanel.tsx:2196-2700): the Director's hidden arcs drawn like arc cards with their
 * "n/threshold" counter, "yours" on the ones the person planted, Delete, and the "Plant invisible arc" form; then DM Notes. Only the person writes notes (the Director never does), so the notes
 * list has an add box RoleCall's does not. A deleted note or hidden arc of the person's own is kept in the scene's archive, not erased.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../../_shared/ic";
import { DIRECTOR_HORIZONS, type DirectorEdit, type DirectorHorizon, type DirectorInvisibleArc, type DirectorNote } from "../../../../../stage/contracts/director-types";
import { HIDDEN_TEXT_MAX, HIDDEN_TITLE_MAX, NOTE_MAX, overdueOf } from "./director-core";
import { Badge, Chevron } from "./director-parts";

export type EditFn = (edit: DirectorEdit, words: string) => Promise<string | null>;

const STATUS_TONE: Readonly<Record<DirectorInvisibleArc["status"], "select" | "info" | "warn" | "ok">> = { seeding: "select", building: "info", approaching_player: "warn", visible: "ok", resolved: "info" };
const HORIZON_TONE: Readonly<Record<DirectorHorizon, "ok" | "info" | "select" | "warn" | "danger">> = { immediate: "danger", short: "ok", medium: "info", long: "warn", epic: "select" };

function HiddenCard({ arc, open, onToggle, onDelete, locked }: { arc: DirectorInvisibleArc; open: boolean; onToggle(): void; onDelete(): void; locked: boolean }): JSX.Element {
  const due = overdueOf(arc.horizon, arc.turnsActive);
  const done = arc.plannedBeats.filter((b) => b.completed).length;
  return (
    <div className="dr-arc" data-part="scene.director.hidden">
      <div className="dr-arc-h" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <span className="dr-arc-t">
          <Badge tone={HORIZON_TONE[arc.horizon]}>{arc.horizon}</Badge>
          <b>{arc.title}</b>
          {arc.userAuthored && <Badge tone="select" title="Planted by you">yours</Badge>}
          {arc.expectedSurfaceTurn !== undefined && <Badge tone="warn">~T{arc.expectedSurfaceTurn}</Badge>}
        </span>
        <span className="dr-arc-s">
          <Badge tone={due.overdue ? "danger" : "mute"}>{due.text}</Badge>
          <Badge tone={STATUS_TONE[arc.status]}>{arc.status.replace("_", " ")}</Badge>
          <button type="button" className="dr-ico" title="Delete arc" aria-label={`Delete ${arc.title}`} disabled={locked} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Ic name="lucide:trash-2" size={12} /></button>
          <Chevron open={open} />
        </span>
      </div>
      {open && (
        <div className="dr-arc-b">
          {arc.description && <p className="dr-dim big">{arc.description}</p>}
          <div className="dr-chips"><Badge>{arc.arcType.replace("_", " ")}</Badge><Badge>{arc.scope}</Badge></div>
          <div className="dr-meta">{arc.turnsActive > 0 && <span>{arc.turnsActive} turns active</span>}<span>{arc.horizon} horizon</span></div>
          {arc.surfaceCondition && <p className="dr-warn-text"><span>Surfaces:</span> {arc.surfaceCondition}</p>}
          {arc.plannedBeats.length > 0 && (
            <div>
              <div className="dr-sub"><Ic name="lucide:list-ordered" size={12} />Planned Beats ({done}/{arc.plannedBeats.length})</div>
              <div className="dr-seeds">{arc.plannedBeats.map((b) => <div key={b.id} className={b.completed ? "done" : ""}><Ic name={b.completed ? "lucide:circle-check" : "lucide:circle"} size={12} /><span>{b.description}</span>{b.hidden && <Ic name="lucide:eye-off" size={12} />}</div>)}</div>
            </div>
          )}
          {arc.stages.length > 0 && (
            <div>
              <div className="dr-sub"><Ic name="lucide:flag" size={12} />Stages ({arc.stages.length})</div>
              <div className="dr-stages">{arc.stages.map((s, i) => <div key={i} className={i === arc.stages.length - 1 ? "now" : ""}><span className="dr-stage-dot" /><b>{s.title}</b>{s.description && <p>{s.description}</p>}<small>Turn {s.turn}</small></div>)}</div>
            </div>
          )}
          {arc.playerClues.length > 0 && (
            <div><div className="dr-sub"><Ic name="lucide:search" size={12} />Player Clues ({arc.playerClues.length})</div>{arc.playerClues.map((c, i) => <p key={i} className="dr-warn-text">{c.clue} <small>(turn {c.turn})</small></p>)}</div>
          )}
          {arc.relatedVisibleArcs.length > 0 && <div><div className="dr-sub"><Ic name="lucide:link" size={12} />Related Arcs</div><div className="dr-chips">{arc.relatedVisibleArcs.map((r, i) => <Badge key={i} tone="info">{r}</Badge>)}</div></div>}
          {arc.foreshadowingSeeds.length > 0 && <div><div className="dr-sub"><Ic name="lucide:leaf" size={12} />Foreshadowing Seeds</div><div className="dr-chips">{arc.foreshadowingSeeds.map((s, i) => <Badge key={i} tone="ok">{s}</Badge>)}</div></div>}
        </div>
      )}
    </div>
  );
}

function PlantForm({ onSubmit, onCancel }: { onSubmit(arc: { title: string; description: string; horizon: DirectorHorizon; surfaceCondition?: string }): Promise<string | null>; onCancel(): void }): JSX.Element {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [horizon, setHorizon] = useState<DirectorHorizon>("medium");
  const [surface, setSurface] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    if (!title.trim() || !description.trim()) { setError("Title and description are required"); return; }
    const why = await onSubmit({ title: title.trim(), description: description.trim(), horizon, ...(surface.trim() ? { surfaceCondition: surface.trim() } : {}) });
    if (why) setError(why);
  };
  return (
    <form className="dr-form" data-part="scene.director.hidden.form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="dr-row"><span className="dr-formhead"><Ic name="lucide:eye-off" size={12} /><b>Plant invisible arc</b></span><button type="button" className="dr-ico" aria-label="Cancel" onClick={onCancel}><Ic name="lucide:x" size={14} /></button></div>
      <label>Title*<input value={title} maxLength={HIDDEN_TITLE_MAX} placeholder="The Faction War" onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Description*<textarea value={description} maxLength={HIDDEN_TEXT_MAX} rows={3} placeholder="What's really happening behind the scenes?" onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Horizon<select value={horizon} onChange={(e) => setHorizon(e.target.value as DirectorHorizon)}>{DIRECTOR_HORIZONS.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
      <label>Surface condition<input value={surface} maxLength={HIDDEN_TEXT_MAX} placeholder="When the player visits the capital" onChange={(e) => setSurface(e.target.value)} /></label>
      {error && <p className="dr-err" role="alert">{error}</p>}
      <div className="dr-row end"><button type="button" className="dr-btn" onClick={onCancel}>Cancel</button><button type="submit" className="dr-btn go">Plant arc</button></div>
    </form>
  );
}

export function HiddenWorld({ arcs, notes, onEdit, locked }: { arcs: readonly DirectorInvisibleArc[]; notes: readonly DirectorNote[]; onEdit: EditFn; locked: boolean }): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const live = arcs.filter((a) => a.status !== "resolved" && a.status !== "visible");
  const concluded = arcs.filter((a) => a.status === "resolved" || a.status === "visible");
  const addNote = async (): Promise<void> => {
    const why = await onEdit({ op: "add-note", content: draft.trim() }, "The note could not be added. Reload this story before trying again.");
    if (why) setNoteError(why); else { setDraft(""); setNoteError(null); }
  };
  return (
    <div className="dr-stack" data-part="scene.director.shadow">
      {adding ? (
        <PlantForm onCancel={() => setAdding(false)} onSubmit={async (arc) => { const why = await onEdit({ op: "add-hidden", ...arc }, "The arc could not be added. Reload this story before trying again."); if (!why) setAdding(false); return why; }} />
      ) : (
        <button type="button" className="dr-plant" disabled={locked} onClick={() => setAdding(true)}><Ic name="lucide:plus" size={14} />Plant invisible arc</button>
      )}
      {live.length > 0 && (
        <div className="dr-stack tight">
          <div className="dr-sub up"><Ic name="lucide:eye-off" size={12} />Invisible Arcs <Badge>{live.length}</Badge></div>
          {live.map((a) => <HiddenCard key={a.id} arc={a} open={open === a.id} locked={locked} onToggle={() => setOpen(open === a.id ? null : a.id)} onDelete={() => void onEdit({ op: "remove-hidden", id: a.id }, "The arc could not be deleted. Reload this story before trying again.")} />)}
        </div>
      )}
      {concluded.length > 0 && (
        <div className="dr-stack tight">
          <div className="dr-sub up"><Ic name="lucide:circle-check" size={12} />Concluded <Badge>{concluded.length}</Badge></div>
          {concluded.slice(-5).map((a) => <div key={a.id} className="dr-done-row"><span>{a.title}</span><Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge></div>)}
        </div>
      )}
      <div className="dr-stack tight" data-part="scene.director.notes">
        <div className="dr-sub up"><Ic name="lucide:file-text" size={12} />DM Notes <Badge>{notes.length}</Badge></div>
        {notes.map((n) => (
          <div key={n.id} className="dr-note"><Ic name="lucide:pencil" size={12} /><p>{n.content}</p><button type="button" className="dr-ico" title="Delete note" aria-label="Delete note" disabled={locked} onClick={() => void onEdit({ op: "remove-note", id: n.id }, "The note could not be deleted. Reload this story before trying again.")}><Ic name="lucide:trash-2" size={12} /></button></div>
        ))}
        <div className="dr-form">
          <label>Add a note for the Director<textarea value={draft} rows={2} maxLength={NOTE_MAX} placeholder="Something the Director should keep in mind" onChange={(e) => setDraft(e.target.value)} /></label>
          {noteError && <p className="dr-err" role="alert">{noteError}</p>}
          <div className="dr-row end"><span className="dr-meta">{draft.length}/{NOTE_MAX}</span><button type="button" className="dr-btn go" disabled={locked || draft.trim() === ""} onClick={() => void addNote()}>Add note</button></div>
        </div>
      </div>
    </div>
  );
}
