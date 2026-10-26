/**
 * One participant in the registry, as RoleCall's ParticipantRow draws it (ParticipantRegistryPanel.tsx:310-404): the swatch, the name,
 * the MAIN and kind chips, the Ping, Color and Scene lines, and the actions. RoleCall's Voice line and editor are left out (voice is out
 * of scope). DELETE retires the participant (restorable); RoleCall's DELETE on the scene's character and the player is dropped because its
 * next roster read puts them straight back, so here those two have no DELETE.
 */
import type { JSX } from "react";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import { protect } from "../../../_shared/protected-control";
import { Button } from "../../../components/button";
import type { RosterRow } from "../../../../core/participants/roster";
import type { ParticipantChange, ParticipantPresence } from "../../../../stage/contracts/chat-store";
import { insertIntoDraft, queueForDraft } from "../context/draft-bus";
import { ColorEditor } from "./participant-colors";

export const pingOf = (name: string): string => `@${name}`;

/** Ping: puts `@Name` in the scene's composer draft at the caret. Display and draft only: it sends nothing and changes no prompt. False when no composer is open. */
export const pingInto = (chatId: string, name: string): boolean => insertIntoDraft(chatId, pingOf(name));

/** What a Ping says back: with no composer open the mention is held and goes in the draft when the composer opens. */
export const pingNoticeOf = (name: string): string => `${pingOf(name)} is queued and goes in your message when the composer opens.`;

/** Ping with honest feedback: inserts at the caret when a composer is open, else queues the mention and says so for a moment. */
export function usePing(chatId: string): { ping(name: string): void; notice: string | null } {
  const { value, flash, clear } = useFlash<string>(FLASH_MS.notice);
  return {
    notice: value,
    ping: (name) => {
      if (pingInto(chatId, name)) { clear(); return; }
      queueForDraft(chatId, pingOf(name));
      flash(pingNoticeOf(name));
    },
  };
}

const SCENE_LINE: Record<ParticipantPresence, string> = { present: "Present: active scene systems", absent: "Absent, kept out of active context", background: "Background, retained, not injected" };

const swatch = (colors: readonly string[]): string | undefined => (colors.length === 0 ? undefined : colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(", ")})`);

function Name({ row, onChange }: { row: RosterRow; onChange(c: ParticipantChange): void }): JSX.Element {
  return (
    <input key={row.name} className="nm" defaultValue={row.name} aria-label={`Name of ${row.name}`}
      onBlur={(e) => { const next = e.currentTarget.value.trim(); if (next && next !== row.name) onChange({ op: "edit", id: row.id, edit: { name: next } }); else e.currentTarget.value = row.name; }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

export function ParticipantRow({ chatId, row, colorsOn, onChange }: { chatId: string; row: RosterRow; colorsOn: boolean; onChange(c: ParticipantChange): void }): JSX.Element {
  const edit = (e: Extract<ParticipantChange, { op: "edit" }>["edit"]): void => onChange({ op: "edit", id: row.id, edit: e });
  const bg = swatch(row.shown);
  const { ping, notice } = usePing(chatId);
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
          <div><dt>Ping</dt><dd>{pingOf(row.name)} <Button variant="quiet" size="sm" data-part="scene.cast.participant.ping" title="Insert the mention into your message" onClick={() => ping(row.name)}>Insert</Button>{notice && <small role="status" data-part="scene.cast.participant.ping-notice"> {notice}</small>}</dd></div>
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
