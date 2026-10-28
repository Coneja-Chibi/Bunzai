/**
 * One linked library tracker opened in the Trackers panel (wireframe premiere/scene-pieces.html, 1a): the back arrow, the name, "Edit tracker" (the piece in the Workbench), the line
 * "Reply N changed ..." (read from the changes route for the reply that last changed it), every field editable, a list's rows as tiles to pick, add and remove, and the hint that a change
 * stays with this reply. The person's edit is the narrator tool's own update shape (use-library-trackers.ts); a refusal shows as a sentence here and nothing else moves.
 */
import { useEffect, useState, type JSX } from "react";
import type { TrackerRecord } from "../../../../../../core/tracker";
import type { SceneTracker, SceneTrackers } from "../../../../../../studio/scene-trackers";
import { VirtualRows } from "../../../../../_shared/virtual-list";
import type { AppContext } from "../../../../../app-contract";
import { Button, IconButton } from "../../../../../components/button";
import { Input } from "../../../../../components/rc-controls";
import { ItemTiles, FieldIcon } from "./library-draw";
import { changeSentence, itemTiles } from "./library-core";
import { FieldEdit, type SetField } from "./library-edit";
import { WAITING, type LibraryTrackers } from "./use-library-trackers";

const FIELD_ESTIMATE_PX = 64;

/** The sentence "Reply N changed ..." for the reply that last changed the tracker, or null while it reads, when nothing changed it, or when the read fails. */
function useChangeNote(ctx: AppContext, data: SceneTrackers, tracker: SceneTracker): string | null {
  const [note, setNote] = useState<string | null>(null);
  const last = tracker.last;
  useEffect(() => {
    if (!last) { setNote(null); return; }
    let live = true;
    ctx.api.getTrackerChanges(data.branchId, last.messageId, last.messageId).then(
      (read) => { if (live) setNote(changeSentence(last.number, read.messages[0]?.trackers.find((t) => t.trackerId === tracker.id)?.changes ?? [])); },
      () => { if (live) setNote(null); },
    );
    return () => { live = false; };
  }, [ctx.api, data, last, tracker.id]);
  return note;
}

/** A list's open row: its fields, and Remove. */
function RowEdit({ tracker, row, set, onRemove, disabled }: { tracker: SceneTracker; row: TrackerRecord; set: SetField; onRemove(): void; disabled: boolean }): JSX.Element {
  return (
    <section className="msn-lib-row" data-part="scene.messenger.trackers.row" data-row={String(row["name"])}>
      <b>{String(row["name"])}</b>
      <VirtualRows items={tracker.body.fields} keyOf={(f) => f.name} estimate={FIELD_ESTIMATE_PX} render={(f) => <FieldEdit field={f} record={row} set={set} disabled={disabled} />} />
      <Button size="sm" variant="quiet" icon="lucide:trash-2" disabled={disabled} onClick={onRemove}>Remove {String(row["name"])}</Button>
    </section>
  );
}

/** "+ add": a name for a new row, which starts with its fields' starting values. */
function AddRow({ onAdd, disabled }: { onAdd(name: string): Promise<unknown>; disabled: boolean }): JSX.Element {
  const [name, setName] = useState("");
  const add = (): void => { if (name.trim() !== "") void onAdd(name.trim()).then(() => setName("")); };
  return (
    <div className="msn-lib-add">
      <Input value={name} placeholder="New item" aria-label="New item name" disabled={disabled} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
      <Button size="sm" icon="lucide:plus" disabled={disabled || name.trim() === ""} onClick={add}>Add</Button>
    </div>
  );
}

export function LibraryDetail({ ctx, data, tracker, edit, running, onBack }: { ctx: AppContext; data: SceneTrackers; tracker: SceneTracker; edit: LibraryTrackers["edit"]; running: boolean; onBack(): void }): JSX.Element {
  const { body } = tracker;
  const note = useChangeNote(ctx, data, tracker);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const canEdit = data.tipId !== null && !running;
  const send = async (update: Parameters<LibraryTrackers["edit"]>[1]): Promise<void> => { setProblem(await edit(tracker.id, update)); };
  const openInWorkbench = (): void => { ctx.workbench.open({ id: tracker.id, kind: "tracker", name: body.name }); ctx.openApp("workbench"); };
  const rows = Array.isArray(tracker.value) ? tracker.value : null;
  const row = rows?.find((r) => r["name"] === picked);
  return (
    <div className="msn-trk-detail msn-lib-detail" data-part={`scene.messenger.trackers.library.detail.${tracker.id}`}>
      <div className="msn-trk-dh">
        <IconButton data-part="scene.messenger.trackers.back" variant="quiet" size="sm" icon="lucide:arrow-left" label="Back to trackers" onClick={onBack} />
        <FieldIcon icon={body.icon} /><b>{body.name}</b><span className="msn-lib-tag">Library</span>
        <span className="msn-lib-grow" />
        <Button data-part="scene.messenger.trackers.library.edit-piece" variant="quiet" size="sm" onClick={openInWorkbench}>Edit tracker</Button>
      </div>
      {note && <p className="dr-note-line" role="status" data-part="scene.messenger.trackers.library.changed">{note}</p>}
      {running && <p className="dr-note-line" role="status" data-part="scene.messenger.trackers.library.waiting">{WAITING}</p>}
      {problem && <p className="dr-note-line bad" role="alert" data-part="scene.messenger.trackers.library.problem">{problem}</p>}
      {rows === null ? (
        <VirtualRows items={body.fields} keyOf={(f) => f.name} estimate={FIELD_ESTIMATE_PX}
          render={(f) => <FieldEdit field={f} record={tracker.value as TrackerRecord} set={(name, value) => send({ set: { [name]: value } })} disabled={!canEdit} />} />
      ) : (
        <>
          {rows.length === 0 ? <p className="msn-lib-none">No items yet.</p> : <ItemTiles tiles={itemTiles(body, rows)} onPick={(name) => setPicked(picked === name ? null : name)} />}
          {row && <RowEdit tracker={tracker} row={row} disabled={!canEdit} set={(name, value) => send({ row: String(row["name"]), set: { [name]: value } })}
            onRemove={() => { setPicked(null); void send({ row: String(row["name"]), remove: true }); }} />}
          <AddRow disabled={!canEdit} onAdd={(name) => send({ row: name, set: {} })} />
        </>
      )}
      <p className="msn-lib-hint" data-part="scene.messenger.trackers.library.hint">
        {canEdit ? (rows === null ? "Drag a bar or type a number. " : "Click an item to edit its fields or remove it. ") + "Your change stays with this reply: swiping or regenerating keeps it." : "Send a message first: a change stays with a reply."}
      </p>
    </div>
  );
}
