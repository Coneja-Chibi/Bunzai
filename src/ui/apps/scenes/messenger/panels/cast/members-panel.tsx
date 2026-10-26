/**
 * The Participants program as the Cast member list (approved wireframe messenger-discord/panels.html 2a), drawn for the Messenger only. It reads and writes exactly what the Full Chat
 * Participants tab does: `useSceneParticipants` (the held roster, `change`, and the Reconcile run with Add selected, Dismiss and Undo), `sceneRoster`, and the Dialogue Colors prop for the color
 * editor. Groups are On stage, NPCs, Registered and Retired with counts (members-model.ts); a face opens the profile card. The search box filters by name and note; Ping and More are on the hover bar. Left out because nothing backs it: Casting Call in the footer (it opens from the My persona editor). Add participant in the footer is the Full Chat form itself (`AddParticipant`). The Reconcile card is the Full Chat card itself, so its slider and run button stay reachable.
 */
import { useMemo, useState, type JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import type { OpenScene } from "../../../../../../studio/scenes";
import type { RosterRow } from "../../../../../../core/participants/roster";
import { useSceneParticipants } from "../../../participants/use-scene-participants";
import { sceneRoster } from "../../../participants/scene-roster";
import { useSceneProps } from "../../../props/use-scene-props";
import { DIALOGUE_COLORS_PROP } from "../../../props/dialogue-colors";
import { AddParticipant } from "../../../cast/add-participant";
import { ReconcileCard } from "../../../cast/reconcile-card";
import { MemberRow } from "./member-row";
import { groupMembers, matchesQuery } from "./members-model";
import { ProfileCard } from "./profile-card";

function Group({ chatId, title, rows, onProfile, onChange }: { chatId: string; title: string; rows: readonly RosterRow[]; onProfile(id: string): void; onChange: ReturnType<typeof useSceneParticipants>["change"] }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} data-part="scene.messenger.cast.group">
      <h3 className="msn-cap">{title} - {rows.length}</h3>
      {rows.map((r) => <MemberRow key={r.id} chatId={chatId} row={r} onProfile={() => onProfile(r.id)} onChange={onChange} />)}
    </section>
  );
}

export function MembersPanel({ ctx, scene, onOpenProgram }: { ctx: AppContext; scene: OpenScene; onOpenProgram(id: string): void }): JSX.Element {
  const chatId = scene.chat.id;
  const { stored, error, change, reconcile, run, confirm, undo, dismiss } = useSceneParticipants(ctx, chatId);
  const props = useSceneProps(ctx, chatId);
  const colorsOn = props.load.state === "ready" && props.load.on.includes(DIALOGUE_COLORS_PROP);
  const roster = useMemo(() => sceneRoster(scene, stored), [scene, stored]);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const g = groupMembers(roster);
    const keep = (rows: RosterRow[]): RosterRow[] => rows.filter((r) => matchesQuery(r, query));
    return { onStage: keep(g.onStage), npcs: keep(g.npcs), registered: keep(g.registered), retired: keep(g.retired) };
  }, [roster, query]);
  const found = groups.onStage.length + groups.npcs.length + groups.registered.length + groups.retired.length;
  const [profile, setProfile] = useState<string | null>(null);
  const all = [roster.main, ...(roster.player ? [roster.player] : []), ...roster.cards, ...roster.npcs, ...roster.retired];
  const shown = all.find((r) => r.id === profile);
  const people = roster.counts.registered;
  return (
    <div className="msn-cm" data-part="scene.messenger.cast.members">
      <p className="msn-cm-count">{people} {people === 1 ? "person" : "people"}</p>
      <input className="msn-cm-find" type="search" data-part="scene.messenger.cast.search" value={query} placeholder="Search cast" aria-label="Search cast" onChange={(e) => setQuery(e.target.value)} />
      <div className="cw-reg msn-cm-recon">
        <ReconcileCard available={scene.messageCount} state={reconcile} onRun={(n) => void run(n)} onConfirm={(names) => void confirm(names)} onUndo={(r) => void undo(r)} onDismiss={dismiss} />
      </div>
      {error && <p className="msn-cm-err" role="alert">{error}</p>}
      <Group chatId={chatId} title="On stage" rows={groups.onStage} onProfile={setProfile} onChange={change} />
      <Group chatId={chatId} title="NPCs" rows={groups.npcs} onProfile={setProfile} onChange={change} />
      <Group chatId={chatId} title="Registered" rows={groups.registered} onProfile={setProfile} onChange={change} />
      <Group chatId={chatId} title="Retired" rows={groups.retired} onProfile={setProfile} onChange={change} />
      {query.trim() !== "" && found === 0 && <p className="msn-cm-count" role="status">Nobody matches "{query.trim()}".</p>}
      <footer className="msn-cm-foot"><AddParticipant rows={all} onChange={change} messenger /></footer>
      {shown && !shown.retired && <ProfileCard chatId={chatId} row={shown} colorsOn={colorsOn} onChange={change} onOpenProgram={onOpenProgram} onClose={() => setProfile(null)} />}
    </div>
  );
}
