/**
 * The Events panel (RoleCall ParallelEventsWingPanel.tsx:359-810): "Meanwhile, elsewhere...", the All Active, Immediate, Looming and Resolved tabs with their counts,
 * event cards with an urgency stripe, a veil on an event the player has not noticed, Resolve Event, a guide box with Refresh, Delete Event, and "Add Event" (title,
 * guide, Generate). The rules are core/trackers/events.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh
 * propose an event kept only on Accept; Delete and Resolve leave an Undo.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { applyEvents, criticalCount, eventsLines, ongoing, readEvents, resolved, type Ev, type Urgency } from "../../../../../../core/trackers/events";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Button } from "../../../../../components/button";
import { Ic } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Empty, ItemCard, ItemList, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const TONE: Readonly<Record<Urgency, string>> = { low: "var(--stage-mute)", medium: "var(--stage-link)", high: "var(--stage-warn)", critical: "var(--stage-danger-text)" };
const LABEL: Readonly<Record<Urgency, string>> = { low: "Low Priority", medium: "Medium", high: "High Priority", critical: "CRITICAL" };
const PLOT_TONE = { immediate: "var(--stage-danger-text)", looming: "var(--stage-warn)", completed: "var(--stage-ok)" } as const;
const PLOT_LABEL = { immediate: "Immediate", looming: "Looming", completed: "Completed" } as const;
const ASK = { module: "events" } as const;
type Tab = "all" | "immediate" | "looming" | "resolved";
const EMPTY: Readonly<Record<Tab, string>> = { all: "No ongoing events", immediate: "No immediate events", looming: "No looming threats", resolved: "No resolved events" };

function Preview({ e }: { e: Ev }): JSX.Element {
  return (
    <>
      <p><b>{e.title}</b> ({LABEL[e.urgency]}, {e.locationName})</p>
      <p>{e.description}</p>
      {e.involvedNpcs.length > 0 && <p className="it-note">Involved: {e.involvedNpcs.map((n) => n.name).join(", ")}</p>}
    </>
  );
}

export function EventsPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "events", readEvents);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);
  const ev = view.data;
  const on = ongoing(ev), done = resolved(ev);
  const critical = criticalCount(ev);
  const shown = tab === "all" ? on : tab === "immediate" ? on.filter((e) => e.plotCategory === "immediate" || !e.plotCategory) : tab === "looming" ? on.filter((e) => e.plotCategory === "looming") : done;
  const act = (action: Parameters<typeof applyEvents>[1], undoLabel?: string): void => view.apply((d) => applyEvents(d, action), undoLabel);
  const counts = { all: on.length, immediate: on.filter((e) => e.plotCategory === "immediate").length, looming: on.filter((e) => e.plotCategory === "looming").length, resolved: done.length };
  const tabs = [
    { id: "all", icon: "lucide:layers", label: "All Active", ...(counts.all > 0 ? { count: counts.all } : {}) }, { id: "immediate", icon: "lucide:zap", label: "Immediate", ...(counts.immediate > 0 ? { count: counts.immediate } : {}) },
    { id: "looming", icon: "lucide:clock", label: "Looming", ...(counts.looming > 0 ? { count: counts.looming } : {}) }, { id: "resolved", icon: "lucide:circle-check", label: "Resolved", ...(counts.resolved > 0 ? { count: counts.resolved } : {}) },
  ] as const;
  return (
    <TrackerFrame label="Events" title="Parallel Events" icon="lucide:layers" tone="var(--stage-var)" tokens={tokensOf(eventsLines(ev))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks events happening simultaneously in the world. The AI progresses these independently of your actions."
      onClear={() => view.apply(() => readEvents(undefined), "Cleared")}
      badge={critical > 0 ? <span className="it-pill bad">{critical} CRITICAL</span> : null}>
      <div className="it-sum"><span className="it-line"><Ic name="lucide:clock" size={14} /><span>Meanwhile, elsewhere...</span></span><span className="it-note">{on.length} active {on.length === 1 ? "event" : "events"}</span></div>
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      <div className="st-body">
        {shown.length > 0 ? (
          <ItemList items={shown} render={(e) => (
              <ItemCard color={TONE[e.urgency]} icon={null} title={e.title}
                chip={e.canIntervene && e.isOngoing ? <span className="it-tag" style={{ "--c": "var(--stage-ok)" } as CSSProperties}>INTERVENE</span> : null}
                meta={<span className="it-line"><Ic name="lucide:map-pin" size={12} /><span>{e.locationName}</span></span>}
                veil={e.isHidden && e.playerAwareness !== "aware" ? <><Ic name="lucide:eye-off" size={20} /><span>{e.playerAwareness === "suspicious" ? "Something is happening..." : "Hidden Event"}</span></> : null}
                right={(
                  <div className="it-pillcol">
                    <span className="it-tag" style={{ "--c": TONE[e.urgency] } as CSSProperties}>{LABEL[e.urgency]}</span>
                    {e.plotCategory && <span className="it-tag" style={{ "--c": PLOT_TONE[e.plotCategory] } as CSSProperties}>{PLOT_LABEL[e.plotCategory]}</span>}
                  </div>
                )}
                open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)}>
                <Block title="Description"><p>{e.description}</p></Block>
                {e.involvedNpcs.length > 0 && (
                  <Block title="Involved Characters">
                    <div className="it-list">{e.involvedNpcs.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (n, i) => (
                      <div key={`${n.name}${i}`} className="ev-npc"><Ic name="lucide:user" size={14} /><div><b>{n.name}</b>{n.role && <small>{n.role}</small>}</div>{n.status && <em>{n.status}</em>}</div>
                    ))}</div>
                  </Block>
                )}
                {e.estimatedDuration && <div className="it-line"><Ic name="lucide:clock" size={14} /><span>Duration: {e.estimatedDuration}</span></div>}
                {e.potentialOutcomes && e.potentialOutcomes.length > 0 && e.isOngoing && <Block title="Potential Outcomes">{e.potentialOutcomes.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (o, i) => <div key={`${o}${i}`} className="it-line"><Ic name="lucide:circle" size={10} /><span>{o}</span></div>)}</Block>}
                {e.actualOutcome && !e.isOngoing && <Block title="Outcome"><div className="ev-out"><p>{e.actualOutcome}</p></div></Block>}
                <div className="it-fine"><div>Started: {new Date(e.startedAt).toLocaleString()}</div>{e.resolvedAt && <div>Resolved: {new Date(e.resolvedAt).toLocaleString()}</div>}</div>
                {e.playerAwareness && e.playerAwareness !== "aware" && <div className="it-line"><Ic name={e.playerAwareness === "suspicious" ? "lucide:search" : "lucide:eye-off"} size={14} /><span>Player is {e.playerAwareness}</span></div>}
                {e.isOngoing && <div className="it-actions"><Button size="sm" icon="lucide:circle-check" onClick={inner(() => act({ kind: "resolve", id: e.id, at: Date.now() }, `Resolved ${e.title}`))}>Resolve Event</Button></div>}
                <RefreshByModel<Ev> ctx={ctx} chatId={chat.id} ask={ASK} noun="event" inline existing={e} preview={(x) => <Preview e={x} />} accept={(x) => act({ kind: "refresh", id: e.id, event: x })}
                  extra={null} />
                <div className="it-actions"><span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete event" onClick={inner(() => { act({ kind: "remove", id: e.id, at: Date.now() }, `Deleted ${e.title}`); setOpen(null); })}>Delete Event</Button></span></div>
              </ItemCard>
            )} />
        ) : <Empty icon={tab === "all" ? "lucide:layers" : tab === "immediate" ? "lucide:zap" : tab === "looming" ? "lucide:clock" : "lucide:circle-check"} title={EMPTY[tab]} hint={tab === "resolved" ? "No events have concluded yet" : "The world is quiet... for now"} />}
        {tab !== "resolved" && (
          <AddByModel<Ev> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Event" noun="event" namePlaceholder="Event Title" guidePlaceholder="Guide the AI... (e.g., 'a siege on the northern fortress')"
            preview={(x) => <Preview e={x} />} accept={(x) => act({ kind: "add", event: x, id: `event-${crypto.randomUUID()}`, at: Date.now() })} />
        )}
      </div>
    </TrackerFrame>
  );
}
