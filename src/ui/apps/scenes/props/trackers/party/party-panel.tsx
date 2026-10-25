/**
 * The Party panel (RoleCall PartyWingPanel.tsx:456-927): the Members and Formation tabs, the party funds, a card for each member with their role and lane, a
 * Make Leader crown, an HP bar and level, Refresh by the model, Remove, and "Add Member" (name, guide, Generate). The Formation tab draws the three lanes and the
 * tactics as RoleCall does; nothing in RoleCall's panel changes them (the Story Director does), so they are shown, not edited. The rules are
 * core/trackers/party.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose a member kept only on Accept.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { hpBand, hpPercent } from "../../../../../../core/trackers/battle";
import { applyParty, liveMembers, partyLines, readParty, POSITIONS, type Member } from "../../../../../../core/trackers/party";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Ic } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Empty, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const ASK = { module: "party" } as const;
type Tab = "members" | "formation";
const TABS = [{ id: "members", icon: "lucide:users", label: "Members" }, { id: "formation", icon: "lucide:grid-3x3", label: "Formation" }] as const;
const BAND = { good: "var(--stage-ok)", low: "var(--stage-warn)", critical: "var(--stage-danger-text)" } as const;
const LANE_ICON = { front: "lucide:shield", mid: "lucide:swords", back: "lucide:wand-sparkles" } as const;
type Made = Omit<Member, "profileId" | "isOnline" | "isLeader" | "removedAt" | "avatarUrl">;

function Preview({ m }: { m: Made }): JSX.Element {
  return <p><b>{m.name}</b> ({m.combatRole}, {m.formationPosition}): HP {m.hp}/{m.maxHp}, MP {m.mp}/{m.maxMp}, level {m.level}</p>;
}

export function PartyPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "party", readParty);
  const [tab, setTab] = useState<Tab>("members");
  const p = view.data;
  const members = liveMembers(p);
  const act = (action: Parameters<typeof applyParty>[1], undoLabel?: string): void => view.apply((d) => applyParty(d, action), undoLabel);
  const add = (
    <AddByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Member" noun="member" namePlaceholder="Member Name" guidePlaceholder="Guide the AI... (e.g., 'a dwarven healer')"
      preview={(m) => <Preview m={m} />} accept={(m) => act({ kind: "add", member: m, id: `member-${crypto.randomUUID()}` })} />
  );
  return (
    <TrackerFrame label="Party" title={p.name || "Party"} icon="lucide:shield" tone="var(--stage-warn)" tokens={tokensOf(partyLines(p))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks your adventuring party: members, roles, HP, and formation. The AI coordinates party members in scenes."
      onClear={() => view.apply(() => readParty(undefined), "Cleared")}
      badge={members.length > 0 ? <span className="it-note">({members.length} members)</span> : null}>
      <Tabs<Tab> tabs={TABS} value={tab} onChange={setTab} />
      <div className="st-body">
        {tab === "members" ? (
          <>
            {members.length === 0 && <Empty icon="lucide:user" title="No party members yet" hint="Build your adventuring party as you journey" />}
            {p.sharedCurrency > 0 && (
              <div className="it-sum" style={{ "--c": "var(--stage-warn)" } as CSSProperties}>
                <div><span className="it-sum-ic" style={{ color: "var(--stage-warn)" }}><Ic name="lucide:coins" size={20} /></span><b style={{ color: "var(--stage-card)", fontWeight: 500 }}>Party Funds</b></div>
                <b>{p.sharedCurrency}</b>
              </div>
            )}
            <div className="it-list">
              {members.map((m) => {
                const lead = m.profileId === p.leaderId;
                const percent = hpPercent(m);
                return (
                  <article key={m.profileId} className={`pt-card${lead ? " lead" : ""}`}>
                    <header>
                      <span className="pt-face"><Ic name="lucide:user" size={20} />{lead && <i><Ic name="lucide:crown" size={10} /></i>}</span>
                      <div className="pt-who"><b>{m.name}</b>{lead && <span className="pt-lead">LEADER</span>}<small><span className="cap">{m.combatRole}</span> • <span className="cap">{m.formationPosition}</span></small></div>
                      {!lead && <button type="button" className="it-act" title="Make Leader" aria-label={`Make ${m.name} leader`} onClick={() => act({ kind: "leader", id: m.profileId })}><Ic name="lucide:crown" size={16} /></button>}
                    </header>
                    <div className="pt-hp">
                      <div><span><i><Ic name="lucide:heart" size={12} /></i> HP</span><b>{m.hp}<small>/{m.maxHp}</small></b></div>
                      <div className="bt-bar"><div style={{ width: `${Math.min(100, percent)}%`, background: BAND[hpBand(percent)] }} /></div>
                    </div>
                    {m.level > 0 && <div className="pt-level"><i><Ic name="lucide:star" size={12} /></i><span>Level</span><b>{m.level}</b></div>}
                    <RefreshByModel<Made> ctx={ctx} chatId={chat.id} ask={ASK} noun="member" existing={m} preview={(x) => <Preview m={x} />} accept={(x) => act({ kind: "refresh", id: m.profileId, member: x })}
                      extra={lead ? null : <button type="button" {...protect("tracker-delete", "it-act bad")} title="Remove member" onClick={inner(() => act({ kind: "remove", id: m.profileId, at: Date.now() }, `Removed ${m.name}`))}><Ic name="lucide:trash-2" size={14} /><span>Remove</span></button>} />
                  </article>
                );
              })}
            </div>
            {add}
          </>
        ) : (
          <div className="it-list">
            <div className="pt-box">
              <div className="pt-boxhead"><span><i><Ic name="lucide:grid-3x3" size={16} /></i> Formation</span><em>{p.formation.mode}</em></div>
              {POSITIONS.map((lane) => {
                const here = members.filter((m) => p.formation.lanes[lane].includes(m.profileId));
                return (
                  <div key={lane} className="pt-lane">
                    <span><Ic name={LANE_ICON[lane]} size={14} /> <span className="cap">{lane}</span></span>
                    <div>{here.length > 0 ? here.map((m) => <em key={m.profileId}>{m.name.slice(0, 10)}</em>) : <i>Empty</i>}</div>
                  </div>
                );
              })}
            </div>
            <div className="pt-box plain">
              <div className="pt-boxhead"><span><i><Ic name="lucide:brain" size={16} /></i> Tactics</span></div>
              <div className="pt-row"><span>Preset</span><b className="cap">{p.tactics.preset}</b></div>
              <div className="pt-row"><span>Conserve Mana</span><b style={{ color: p.tactics.conserveMana ? "var(--stage-link)" : "var(--stage-mute)" }}>{p.tactics.conserveMana ? "Yes" : "No"}</b></div>
              <div className="pt-row"><span>Focus</span><b className="cap">{p.tactics.focus}</b></div>
            </div>
          </div>
        )}
      </div>
    </TrackerFrame>
  );
}
