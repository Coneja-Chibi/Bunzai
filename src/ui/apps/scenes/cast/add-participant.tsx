/**
 * Add participant: a person written in by hand (a name, an optional note, and whether they are on stage), sent as one `{op:"add"}` run through the
 * roster writer the Participants tab and the Messenger members panel already share. Each add mints its own run id, so Undo of that run retires exactly
 * these people. The store refuses a name already on the roster; the form checks the same rule first so the person keeps what they typed.
 */
import { useState, type JSX } from "react";
import { Button, Segmented } from "../../../components/button";
import type { RosterRow } from "../../../../core/participants/roster";
import { PARTICIPANT_DESCRIPTION_MAX, PARTICIPANT_NAME_MAX, type ParticipantChange, type ParticipantPresence } from "../../../../stage/contracts/chat-participant-types";
import { nameKey } from "../../../../stage/store/participant-rules";

const PRESENCE = [{ value: "present", label: "Present" }, { value: "background", label: "Background" }, { value: "absent", label: "Absent" }] as const;

export function AddParticipant({ rows, onChange, messenger }: { rows: readonly Pick<RosterRow, "name">[]; onChange(c: ParticipantChange): void; messenger?: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [presence, setPresence] = useState<ParticipantPresence>("present");
  const [problem, setProblem] = useState<string | null>(null);
  const close = (): void => { setOpen(false); setName(""); setNote(""); setPresence("present"); setProblem(null); };
  const submit = (): void => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean === "") return setProblem("Give them a name.");
    if (rows.some((r) => nameKey(r.name) === nameKey(clean))) return setProblem(`${clean} is already on the roster.`);
    const description = note.trim();
    onChange({ op: "add", run: `add-${crypto.randomUUID()}`, people: [{ name: clean, ...(description ? { description } : {}), presence }] });
    close();
  };
  if (!open) return <div className="addp" data-part={messenger ? "scene.messenger.cast.add" : "scene.cast.add"}><Button size="sm" icon="lucide:plus" onClick={() => setOpen(true)}>Add participant</Button></div>;
  return (
    <form className="addp open" data-part={messenger ? "scene.messenger.cast.add" : "scene.cast.add"} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input autoFocus value={name} maxLength={PARTICIPANT_NAME_MAX} placeholder="Name" aria-label="New participant name" onChange={(e) => { setName(e.currentTarget.value); setProblem(null); }} />
      <input value={note} maxLength={PARTICIPANT_DESCRIPTION_MAX} placeholder="Note (optional)" aria-label="New participant note" onChange={(e) => setNote(e.currentTarget.value)} />
      <Segmented label="Presence of the new participant" size="sm" items={PRESENCE} value={presence} onChange={setPresence} />
      {problem && <p className="addp-err" role="alert">{problem}</p>}
      <div className="acts"><Button type="submit" variant="primary" size="sm">Add</Button><Button variant="quiet" size="sm" onClick={close}>Cancel</Button></div>
    </form>
  );
}
