/**
 * The person's edits of the Director's story (behavior 11), as pure operations on a state, and the record of them the state keeps. Every edit is applied by `applyEdit` and
 * remembered by `record`, so a new version of the reply it was made on (a regenerate, a swipe, a guided re-roll) or a plan that was still out when it was made can carry it: `replay` applies
 * every edit the source remembers that the target does not. Removal is soft, a person's notes and hidden arcs are never dropped, and an edit whose item the target no longer has (the item was made
 * by the very round that is being replaced and the new round did not make it again) is skipped, because there is nothing to apply it to; it is still remembered, so it is not tried twice.
 */
import { DIRECTOR_CAPS, DIRECTOR_LIVE_CAPS, type DirectorArchive, type DirectorEdit, type DirectorEditRecord, type DirectorInvisibleArc, type DirectorState } from "../../stage/contracts/director-types";
import { emptyDirectorState, liveInvisible, liveNotes } from "./state";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** What the person is told when their own notes and hidden arcs alone fill what a snapshot can hold. Reset would wipe them, so it is never the advice. */
export const TOO_LARGE = "Your notes and hidden arcs are too large to save. Remove some in the Debug tab.";

/** Why an edit cannot be made now, in words; null when it can. */
export function refusal(s: DirectorState, edit: DirectorEdit): string | null {
  if (edit.op === "add-note") {
    if (liveNotes(s).length >= DIRECTOR_LIVE_CAPS.notes) return "the Director holds as many notes as it can; remove one first";
  }
  if (edit.op === "add-hidden") {
    if (liveInvisible(s).length >= DIRECTOR_LIVE_CAPS.invisibleArcs) return "the Director holds as many hidden arcs as it can; remove one first";
  }
  return null;
}

/** A note is known by its id and the start of its text: its whole text in the record would hand back the room removing it just freed. */
const NOTE_LABEL_MAX = 80;

/** What an id-edit is about, to find the same thing by name in another state. */
export function labelOf(s: DirectorState, edit: DirectorEdit): string | undefined {
  switch (edit.op) {
    case "resolve-arc": case "remove-arc": return s.arcs.find((a) => a.id === edit.id)?.title;
    case "remove-seed": return s.seeds.find((a) => a.id === edit.id)?.hint;
    case "remove-hidden": return s.invisibleArcs.find((a) => a.id === edit.id)?.title;
    case "remove-note": return s.notes.find((a) => a.id === edit.id)?.content.slice(0, NOTE_LABEL_MAX);
    default: return undefined;
  }
}

/** What an edit made: the state, the activity line it earns, and the person's rows it took out of the snapshot (the caller keeps those in the scene's archive; they are never deleted). */
export interface Applied { state: DirectorState; line: string; archived?: DirectorArchive }

/**
 * The edit made; null when the item it is about is not in the state. `recId` is the id of the edit's record: the note or hidden arc an add makes takes its id from it, so replaying the add
 * makes the same row, and the remove that follows it finds it. A person's own note or hidden arc that is removed leaves the snapshot (archived); a model-made hidden arc is soft-removed.
 */
export function applyEdit(base: DirectorState, edit: DirectorEdit, now: number, label?: string, recId?: string): Applied | null {
  const s = structuredClone(base);
  // An edit about an item applies only to the item it was made on: the same id AND the same name as when it was made. A regenerate hands out the same ids again to different items, so an id alone
  // would land the edit on a stranger; a name alone could hit a similar one. No match is a skip, never a guess.
  const find = <T extends { id: string; removedAt?: number }>(list: T[], name: (x: T) => string): T | undefined =>
    label === undefined ? undefined : list.find((x) => x.removedAt === undefined && x.id === (edit as { id?: string }).id && norm(name(x)) === norm(label));
  switch (edit.op) {
    case "resolve-arc": { const a = find(s.arcs, (x) => x.title); if (!a) return null; a.status = "complete"; return { state: s, line: `Marked arc "${a.title}" complete` }; }
    case "remove-arc": { const a = find(s.arcs, (x) => x.title); if (!a) return null; a.removedAt = now; return { state: s, line: `Removed arc "${a.title}"` }; }
    case "remove-seed": { const x = find(s.seeds, (y) => y.hint); if (!x) return null; x.removedAt = now; return { state: s, line: `Removed seed "${x.hint}"` }; }
    case "remove-hidden": {
      const x = find(s.invisibleArcs, (y) => y.title);
      if (!x) return null;
      if (!x.userAuthored) { x.removedAt = now; return { state: s, line: `Removed hidden arc "${x.title}"` }; }
      s.invisibleArcs = s.invisibleArcs.filter((y) => y !== x);
      return { state: s, line: `Removed hidden arc "${x.title}"`, archived: { notes: [], hidden: [{ ...x, removedAt: now }] } };
    }
    case "remove-note": {
      const x = find(s.notes, (y) => y.content.slice(0, NOTE_LABEL_MAX));
      if (!x) return null;
      s.notes = s.notes.filter((y) => y !== x);
      return { state: s, line: "Removed a note", archived: { notes: [{ ...x, removedAt: now }], hidden: [] } };
    }
    case "add-note": {
      const id = `note-${recId ?? s.nextId++}`;
      if (s.notes.some((n) => n.id === id)) return { state: s, line: "" };
      if (refusal(s, edit)) return null;
      s.notes.push({ id, content: edit.content, createdAt: now });
      return { state: s, line: "Added a note" };
    }
    case "add-hidden": {
      const id = `hidden-${recId ?? s.nextId++}`;
      if (s.invisibleArcs.some((a) => a.id === id)) return { state: s, line: "" };
      if (refusal(s, edit)) return null;
      // Room comes from the model's own removed rows, never from a person's.
      const gone = s.invisibleArcs.findIndex((a) => a.removedAt !== undefined && !a.userAuthored);
      if (s.invisibleArcs.length >= DIRECTOR_CAPS.invisibleArcs && gone >= 0) s.invisibleArcs.splice(gone, 1);
      if (s.invisibleArcs.length >= DIRECTOR_CAPS.invisibleArcs) return null;
      const horizon = edit.horizon ?? "medium";
      const arc: DirectorInvisibleArc = {
        id, title: edit.title, description: edit.description ?? edit.title, arcType: "background", horizon, scope: "world", status: "seeding", turnsActive: 0, plannedBeats: [], stages: [],
        ...(edit.surfaceCondition ? { surfaceCondition: edit.surfaceCondition } : {}), relatedVisibleArcs: [], foreshadowingSeeds: [], playerClues: [], userAuthored: true, createdAtTurn: s.turn ?? 0,
      };
      s.invisibleArcs.push(arc);
      return { state: s, line: `Planted hidden arc "${arc.title}"` };
    }
    case "clear-activity": s.activityClearedAt = now; return { state: s, line: "" };
    case "reset": {
      // The story is emptied; what the person wrote is not lost with it, it goes to the archive.
      const notes = liveNotes(s).map((n) => ({ ...n, removedAt: now }));
      const hidden = s.invisibleArcs.filter((a) => a.userAuthored && a.removedAt === undefined).map((a) => ({ ...a, removedAt: now }));
      return { state: { ...emptyDirectorState(), activity: s.activity, nextId: s.nextId, ...(s.turn !== undefined ? { turn: s.turn } : {}), ...(s.edits ? { edits: s.edits } : {}) }, line: "Reset the Director's story", archived: { notes, hidden } };
    }
  }
}

/** The state with `edit` remembered (at most DIRECTOR_CAPS.edits, the oldest go). */
export function record(s: DirectorState, edit: DirectorEdit, at: number, label?: string, id?: string): DirectorState {
  const next = structuredClone(s);
  const rec: DirectorEditRecord = { id: id ?? `edit-${next.nextId++}`, at, edit, ...(label ? { label } : {}) };
  next.edits = [...(next.edits ?? []), rec].slice(-DIRECTOR_CAPS.edits);
  return next;
}

/**
 * The target with every edit the source remembers and the target does not, in the order they were made. An edit whose item the target lacks is skipped now and handed back in `missed`:
 * the round that follows may reuse that id for an item of the same name, and `retry` then applies the edit to it. A removal holds only while the planner reuses the same id and name; it can plant
 * the same idea again under a new one, as it can on any later turn, because it never sees what was removed (RoleCall does the same).
 */
export function replay(target: DirectorState, source: DirectorState | null | undefined, missed: DirectorEditRecord[] = []): DirectorState {
  let out = target;
  const had = new Set((target.edits ?? []).map((e) => e.id));
  for (const rec of source?.edits ?? []) {
    if (had.has(rec.id)) continue;
    const made = applyEdit(out, rec.edit, rec.at, rec.label, rec.id);
    if (!made) missed.push(rec);
    out = record(made?.state ?? out, rec.edit, rec.at, rec.label, rec.id);
    had.add(rec.id);
  }
  return out;
}

/** The missed edits applied to a state that may now have what they were about; the ones that still find nothing change nothing. */
export const retry = (s: DirectorState, missed: readonly DirectorEditRecord[]): DirectorState => missed.reduce((acc, rec) => applyEdit(acc, rec.edit, rec.at, rec.label, rec.id)?.state ?? acc, s);
