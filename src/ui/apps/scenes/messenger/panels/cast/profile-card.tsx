/**
 * The profile card popout (panels.html 2b), opened by a face in the member list: the person's name (editable, as the Participants tab's name field is), what is written about them, the
 * scene presence, the color, Set or Unset Main, Edit card (the scene's character and the player have an editor, an NPC has none) and Delete (an NPC only, as the Participants tab). Every control
 * calls the writer the Participants tab calls (`change`, from useSceneParticipants) and the color editor is that tab's own, still gated on Dialogue Colors.
 * Ping puts `@Name` in the composer draft. The color is six palette swatches plus the tab's own editor, and the scene's character has a "Uses card gradient" switch: on clears the colors (the card's own show), off keeps a color of its own. Nothing here is a mute: that needs the per-participant mute of invited characters, which has no writer.
 * The note under the name is the person's description, written through the same writer as the Add participant note.
 */
import type { JSX } from "react";
import { protect } from "../../../../../_shared/protected-control";
import { Button, Segmented, Toggle } from "../../../../../components/button";
import type { RosterRow } from "../../../../../../core/participants/roster";
import type { ParticipantChange, ParticipantPresence } from "../../../../../../stage/contracts/chat-store";
import { pickPaletteHex } from "../../../../../../core/participants/palette";
import { ColorEditor, SIX_SWATCHES } from "../../../cast/participant-colors";
import { usePing } from "../../../cast/participant-row";
import { Popout } from "../../frames/popout";
import { MemberFace } from "./member-face";
import { faceFill, statusLine } from "./members-model";

const PRESENCE = [{ value: "present", label: "Present" }, { value: "background", label: "Background" }, { value: "absent", label: "Absent" }] as const;
const KIND_LABEL: Readonly<Record<RosterRow["kind"], string>> = { card: "Card", player: "Player", npc: "NPC" };
/** The program that edits a person's card: the scene's character, or the player's persona. */
const EDITOR_OF: Readonly<Record<RosterRow["kind"], string | null>> = { card: "characters", player: "persona", npc: null };

export interface ProfileCardProps {
  chatId: string;
  row: RosterRow;
  colorsOn: boolean;
  onChange(c: ParticipantChange): void;
  onOpenProgram(id: string): void;
  onClose(): void;
}

export function ProfileCard({ chatId, row, colorsOn, onChange, onOpenProgram, onClose }: ProfileCardProps): JSX.Element {
  const edit = (e: Extract<ParticipantChange, { op: "edit" }>["edit"]): void => onChange({ op: "edit", id: row.id, edit: e });
  const { ping, notice } = usePing(chatId);
  const editor = EDITOR_OF[row.kind];
  const about = statusLine(row);
  const banner = faceFill(row.shown);
  return (
    <Popout title={`${row.name}, profile`} width={320} onClose={onClose}>
      <div className="msn-pc" data-part="scene.messenger.cast.profile">
        <div className="msn-pc-bn" style={banner ? { background: banner } : undefined} />
        <div className="msn-pc-hd"><MemberFace row={row} big />
          <input key={row.name} className="msn-pc-name" data-part="scene.messenger.cast.profile.name" defaultValue={row.name} aria-label={`Name of ${row.name}`}
            onBlur={(e) => { const next = e.currentTarget.value.trim(); if (next && next !== row.name) edit({ name: next }); else e.currentTarget.value = row.name; }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        </div>
        {about && !row.description && <p className="msn-pc-about">{about}</p>}
        <input className="msn-pc-note-in" data-part="scene.messenger.cast.profile.note" key={`${row.id}:${row.description ?? ""}`} defaultValue={row.description ?? ""} placeholder="Add a note" aria-label={`Note about ${row.name}`}
          onBlur={(e) => { const next = e.currentTarget.value.trim(); if (next !== (row.description ?? "").trim()) edit({ description: next === "" ? null : next }); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <div className="msn-pc-chips"><span className="msn-cm-badge">{KIND_LABEL[row.kind]}</span>{row.main && <span className="msn-cm-badge">Main</span>}</div>
        <div className="msn-pc-sec"><span className="msn-cap">In this scene</span>
          <Segmented<ParticipantPresence> label={`Scene presence for ${row.name}`} size="sm" data-part="scene.messenger.cast.profile.presence" items={PRESENCE} value={row.presence} onChange={(p) => edit({ presence: p })} />
        </div>
        <div className="msn-pc-sec"><span className="msn-cap">Color</span>
          {row.kind === "card" && <Toggle size="sm" on={row.colors.length === 0} disabled={!colorsOn} data-part="scene.messenger.cast.profile.card-gradient" label="Uses card gradient" title={colorsOn ? undefined : "Turn on Dialogue Colors in Props to edit participant colors"}
            onChange={(on) => edit({ colors: on ? null : [row.shown[0] ?? pickPaletteHex(row.id)] })} />}
          {(row.kind !== "card" || row.colors.length > 0) && <ColorEditor row={row} enabled={colorsOn} palette={SIX_SWATCHES} onColors={(c) => edit({ colors: c })} />}
        </div>
        {notice && <small className="msn-pc-note" role="status" data-part="scene.messenger.cast.profile.ping-notice">{notice}</small>}
        <div className="msn-pc-acts">
          <Button size="sm" icon="lucide:message-circle" data-part="scene.messenger.cast.profile.ping" onClick={() => ping(row.name)}>Ping</Button>
          {row.main && row.anchored ? <span className="msn-pc-note">Anchored to the scene card</span>
            : row.main ? <Button size="sm" data-part="scene.messenger.cast.profile.unset-main" onClick={() => onChange({ op: "main", id: null })}>Unset Main</Button>
            : <Button size="sm" data-part="scene.messenger.cast.profile.set-main" onClick={() => onChange({ op: "main", id: row.id })}>Set Main</Button>}
          {editor && <Button size="sm" variant="primary" data-part="scene.messenger.cast.profile.edit-card" onClick={() => { onOpenProgram(editor); onClose(); }}>Edit card</Button>}
        </div>
        {row.kind === "npc" && (
          <span {...protect("participant-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" data-part="scene.messenger.cast.profile.delete" onClick={() => { edit({ retired: true }); onClose(); }}>Delete</Button></span>
        )}
      </div>
    </Popout>
  );
}
