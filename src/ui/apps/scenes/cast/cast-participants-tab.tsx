/**
 * The Cast wing's Participants tab, RoleCall's Participant Registry (ParticipantRegistryPanel.tsx), drawn from its live screenshots: the
 * hero, the REGISTERED, NPCS and ON STAGE counters, RECONCILE RECENT SCENE, then the main character, the player, any cards and the NPCs,
 * each with its Ping, Color and Scene. Left out, with reasons: ROSTER DIRECTOR (it chooses which agent maintains the roster; Bunraku has
 * no such agent, and RoleCall's own Reconcile ignores it), the VOICE line and editor (text-to-speech is out of scope), and Suggested Main
 * Slot (the scene's character is always the main until Set Main moves it). RETIRED lists what DELETE removed, with Restore.
 * Mounted by the Cast wing's `tab === "participants"`.
 */
import type { JSX } from "react";
import { protect } from "../../../_shared/protected-control";
import type { RosterRow } from "../../../../core/participants/roster";
import type { ParticipantChange } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import type { AppContext } from "../../../app-contract";
import { useSceneProps } from "../props/use-scene-props";
import { DIALOGUE_COLORS_PROP } from "../props/dialogue-colors";
import { useSceneParticipants } from "../participants/use-scene-participants";
import { sceneRoster } from "../participants/scene-roster";
import { CastHero } from "./cast-parts";
import { ParticipantRow } from "./participant-row";
import { ReconcileCard } from "./reconcile-card";

function Section({ title, rows, empty, colorsOn, onChange }: { title: string; rows: RosterRow[]; empty: string; colorsOn: boolean; onChange(c: ParticipantChange): void }): JSX.Element | null {
  if (rows.length === 0 && empty === "") return null;
  return (
    <section className="sec">
      <h3>{title}</h3>
      {rows.length === 0 ? <div className="none">{empty}</div> : <div className="rows">{rows.map((r) => <ParticipantRow key={r.id} row={r} colorsOn={colorsOn} onChange={onChange} />)}</div>}
    </section>
  );
}

export function ParticipantsTab({ ctx, scene }: { ctx: AppContext; scene: OpenScene }): JSX.Element {
  const chatId = scene.chat.id;
  const { stored, error, change, reconcile, run, confirm, undo, dismiss } = useSceneParticipants(ctx, chatId);
  const props = useSceneProps(ctx, chatId);
  const colorsOn = props.load.state === "ready" && props.load.on.includes(DIALOGUE_COLORS_PROP);
  const roster = sceneRoster(scene, stored);
  const { counts } = roster;
  return (
    <div className="cw cw-participants" data-part="scene.cast.participants">
      <CastHero icon="lucide:users-round" eyebrow="Shared registry" title="Participant" emphasis="Registry" sub="Canonical roster for pings, dialogue colors, character memory, and scene systems." />
      <div className="cw-reg">
        <div className="stats">
          <div className="stat"><small>Registered</small><b>{counts.registered}</b></div>
          <div className="stat"><small>NPCs</small><b>{counts.npcs}</b></div>
          <div className="stat"><small>On Stage</small><b>{counts.onStage}</b></div>
        </div>
        <ReconcileCard available={scene.messageCount} state={reconcile} onRun={(n) => void run(n)} onConfirm={(names) => void confirm(names)} onUndo={(r) => void undo(r)} onDismiss={dismiss} />
        {error && <p className="notice gone" role="alert">{error}</p>}
        <Section title="Main Character" rows={[roster.main]} empty="No main character registered." colorsOn={colorsOn} onChange={change} />
        <Section title="Player" rows={roster.player ? [roster.player] : []} empty="" colorsOn={colorsOn} onChange={change} />
        <Section title="Cards" rows={roster.cards} empty="No card participants registered." colorsOn={colorsOn} onChange={change} />
        <Section title="NPCs" rows={roster.npcs} empty="No NPCs registered yet." colorsOn={colorsOn} onChange={change} />
        {roster.retired.length > 0 && (
          <section className="sec">
            <h3>Retired</h3>
            <div className="rows">{roster.retired.map((r) => (
              <div key={r.id} className="prow"><div className="bd"><div className="hd"><b className="nm">{r.name}</b><span className="chip">npc</span><button type="button" {...protect("participant-delete")} onClick={() => change({ op: "edit", id: r.id, edit: { retired: false } })}>Restore</button></div></div></div>
            ))}</div>
          </section>
        )}
      </div>
    </div>
  );
}
