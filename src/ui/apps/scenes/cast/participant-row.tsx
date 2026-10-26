/**
 * One participant in the registry, as RoleCall's ParticipantRow draws it (ParticipantRegistryPanel.tsx:310-404): the swatch, the name,
 * the MAIN and kind chips, the Ping, Color and Scene lines, and the actions. RoleCall's Voice line and editor are left out (voice is out
 * of scope). DELETE retires the participant (restorable); RoleCall's DELETE on the scene's character and the player is dropped because its
 * next roster read puts them straight back, so here those two have no DELETE.
 */
import type { JSX } from "react";
import { protect } from "../../../_shared/protected-control";
import { Button } from "../../../components/button";
import type { RosterRow } from "../../../../core/participants/roster";
import type { ParticipantChange, ParticipantPresence } from "../../../../stage/contracts/chat-store";
import { ColorEditor } from "./participant-colors";

export const pingOf = (name: string): string => `@${name}`;

const SCENE_LINE: Record<ParticipantPresence, string> = { present: "Present: active scene systems", absent: "Absent, kept out of active context", background: "Background, retained, not injected" };

const swatch = (colors: readonly string[]): string | undefined => (colors.length === 0 ? undefined : colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(", ")})`);

function Name({ row, onChange }: { row: RosterRow; onChange(c: ParticipantChange): void }): JSX.Element {
  return (
    <input key={row.name} className="nm" defaultValue={row.name} aria-label={`Name of ${row.name}`}
      onBlur={(e) => { const next = e.currentTarget.value.trim(); if (next && next !== row.name) onChange({ op: "edit", id: row.id, edit: { name: next } }); else e.currentTarget.value = row.name; }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

export function ParticipantRow({ row, colorsOn, onChange }: { row: RosterRow; colorsOn: boolean; onChange(c: ParticipantChange): void }): JSX.Element {
  const edit = (e: Extract<ParticipantChange, { op: "edit" }>["edit"]): void => onChange({ op: "edit", id: row.id, edit: e });
  const bg = swatch(row.shown);
  return (
    <div className={`prow${row.main ? " main" : ""}`} data-part="scene.cast.participant">
      <span className="sw" style={bg ? { background: bg } : undefined} />
      <div className="bd">
        <div className="hd">
          <Name row={row} onChange={onChange} />
          {row.main && <span className="chip on">Main</span>}
          <span className="chip">{row.kind}</span>
        </div>
        <dl className="lines">
          <div><dt>Ping</dt><dd>{pingOf(row.name)}</dd></div>
          <div><dt>Color</dt><dd>{row.shown.join(", ") || "Unassigned"}</dd></div>
          <div><dt>Scene</dt><dd>{SCENE_LINE[row.presence]}</dd></div>
        </dl>
        <div className="acts">
          {row.main && row.anchored ? <span className="anch" title="The main slot follows the scene's character card. Use Set Main on another participant to swap.">Anchored to the scene card</span>
            : row.main ? <Button size="sm" onClick={() => onChange({ op: "main", id: null })}>Unset Main</Button>
            : <Button size="sm" onClick={() => onChange({ op: "main", id: row.id })}>Set Main</Button>}
          {row.anchored ? <span className="anch card">Uses Card Gradient</span> : <ColorEditor row={row} enabled={colorsOn} onColors={(c) => edit({ colors: c })} />}
          <label className="scene" title="Shared scene state used by scene-aware features.">Scene
            <select aria-label={`Scene presence for ${row.name}`} value={row.presence} onChange={(e) => edit({ presence: e.currentTarget.value as ParticipantPresence })}>
              <option value="present">Present</option><option value="background">Background</option><option value="absent">Absent</option>
            </select>
          </label>
          {row.kind === "npc" && <span {...protect("participant-delete")}><Button variant="danger" size="sm" onClick={() => edit({ retired: true })}>Delete</Button></span>}
        </div>
      </div>
    </div>
  );
}
