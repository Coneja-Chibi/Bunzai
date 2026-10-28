/**
 * The Trackers panel as the Messenger draws it (approved wireframe messenger-discord/panels.html section 5): one list of the trackers that are on, the way Discord lists pinned messages, in
 * place of sixteen programs. Each is a card with its name and kind and a hover bar (Open, Pop out); Open drills into that tracker's OWN panel inside this one with a back arrow, so Refresh from
 * chat history, Clear all data with its Undo, AI Context, the item controls and the Story Director's update line are the module's, unchanged. The gear is the Story Director's automatic
 * update setting (`AutoUpdate`, written through the Director's own settings writer); "Change in Story Director" and "Manage features" use the page's existing door to the Props program. A
 * Storyboard has no panel of its own, so its Open is the Prop's gear (the Compendium's Storyboards). Each card also shows its module's one-line summary (props/trackers/summary.ts). The library trackers the scene links (ChatPrompting.trackers) lead the list as cards with a Library tag and the reply that last changed them, drawn and edited in library-draw.tsx, library-detail.tsx and library-pick.tsx (wireframe premiere/scene-pieces.html). Not drawn because nothing backs them yet (map-panels.md section 5): the last-update turn on each card, the tracker generation model (the scene's model is used, Chi's decision), and the in-list Refresh and Clear on a card (each lives in its module's panel).
 */
import { useEffect, useState, type CSSProperties, type JSX } from "react";
import { Button, IconButton, ListRow } from "../../../../../components/button";
import { Ic } from "../../../../../_shared/ic";
import { sceneProps } from "../../../props/registry";
import type { SceneProp } from "../../../props/prop-contract";
import { openDirectorSettings } from "../../../props/story-director/director-live";
import { AutoUpdate } from "../../../props/story-director/auto-update";
import { useDirectorPanel } from "../../../props/story-director/use-director-panel";
import { trackerSummary } from "../../../props/trackers/summary";
import { SubFeatureList } from "../../../props/trackers/sub-features";
import type { PopoutContext } from "../../../popout/popout-kind";
import { PopoutSlot } from "../../../popout/popout-host";
import { usePopout } from "../../../popout/popout-store";
import { VirtualRows } from "../../../../../_shared/virtual-list";
import { LibraryCard } from "./library-draw";
import { LibraryDetail } from "./library-detail";
import { LibraryPick } from "./library-pick";
import { takeTrackerOpen, useRequestedTracker } from "./open-tracker";
import { isOpenable, isTrackerProp, moduleOf, trackersSummary } from "./trackers-core";
import { useLibraryTrackers } from "./use-library-trackers";

const LIBRARY_CARD_PX = 150;


function PopOutButton({ prop, ctx }: { prop: SceneProp; ctx: PopoutContext["ctx"] }): JSX.Element {
  const id = moduleOf(prop);
  const po = usePopout(ctx, prop.panel!.id);
  return <IconButton data-part={`scene.messenger.trackers.card.popout.${id}`} variant="quiet" size="sm" icon="lucide:external-link" label={`Pop out ${prop.name}`} onClick={po.open} />;
}

function Card({ prop, ctx, chat, onOpen }: { prop: SceneProp; ctx: PopoutContext["ctx"]; chat: PopoutContext["chat"]; onOpen(): void }): JSX.Element {
  const id = moduleOf(prop);
  const line = trackerSummary(id, chat.trackers?.[id]);
  return (
    <div className="msn-trk-card" data-part={`scene.messenger.trackers.card.${id}`} style={{ "--tone": prop.tone } as CSSProperties}>
      <ListRow data-part={`scene.messenger.trackers.card.open.${id}`} leading={<Ic name={prop.icon} size={16} />} label={prop.name} subtitle={prop.tier} variant="picker" onClick={onOpen} />
      {line && <p className="msn-trk-line" data-part={`scene.messenger.trackers.card.summary.${id}`}>{line}</p>}
      <span className="msn-trk-bar">
        {prop.panel && <PopOutButton prop={prop} ctx={ctx} />}
        <IconButton data-part={`scene.messenger.trackers.card.arrow.${id}`} variant="quiet" size="sm" icon="lucide:arrow-right" label={`Open ${prop.name}`} onClick={onOpen} />
      </span>
    </div>
  );
}

/** One tracker, opened in place: the module's own panel, and its sub-feature switches when it has them. */
function Detail({ prop, ctx, chat, onChat, onBack }: { prop: SceneProp; onBack(): void } & Pick<PopoutContext, "ctx" | "chat" | "onChat">): JSX.Element {
  const id = moduleOf(prop);
  return (
    <div className="msn-trk-detail" data-part={`scene.messenger.trackers.detail.${id}`}>
      <div className="msn-trk-dh"><IconButton data-part="scene.messenger.trackers.back" variant="quiet" size="sm" icon="lucide:arrow-left" label="Back to trackers" onClick={onBack} /><b>{prop.name}</b></div>
      {prop.panel && <PopoutSlot kind={prop.panel} ctx={ctx} chat={chat} {...(onChat ? { onChat } : {})} />}
      {prop.subs && (
        <section className="msn-trk-subs" data-part="scene.messenger.trackers.subs">
          <h3>Sub-features</h3>
          <SubFeatureList ctx={ctx} chat={chat} {...(onChat ? { onChat } : {})} module={moduleOf(prop)} subs={prop.subs} tone={prop.tone} />
        </section>
      )}
    </div>
  );
}

export function MessengerTrackersPanel({ ctx, chat, onChat, ids }: PopoutContext & { ids: readonly string[] }): JSX.Element {
  const all = sceneProps();
  const shown = ids.flatMap((id) => all.find((p) => p.id === id && isOpenable(p)) ?? []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [gear, setGear] = useState(false);
  const [openLib, setOpenLib] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const linked = chat.prompting?.trackers ?? [];
  const lib = useLibraryTrackers(ctx, chat, linked);
  const requested = useRequestedTracker(chat.id);
  // A chip under a reply asked for this tracker (open-tracker.ts): open it, whatever the panel was showing.
  useEffect(() => { if (requested === null) return; setOpenLib(requested); setPicking(false); setOpenId(null); takeTrackerOpen(chat.id); }, [requested, chat.id]);
  const dm = useDirectorPanel(ctx, chat);
  const opened = openId === null ? undefined : shown.find((p) => p.id === openId && p.panel);
  const more = all.filter((p) => isTrackerProp(p) && isOpenable(p)).length - shown.length;
  const director = dm.load.state === "ready" ? dm.load.panel : null;
  const open = (p: SceneProp): void => { if (p.panel) setOpenId(p.id); else p.gear?.(); };

  const libOpened = openLib !== null && lib.load.state === "ready" ? lib.load.data.trackers.find((t) => t.id === openLib) : undefined;

  if (picking) return <div className="msn-trk" data-part="scene.messenger.trackers"><LibraryPick ctx={ctx} chat={chat} linked={linked} bodies={lib.load.state === "ready" ? lib.load.data.trackers.map((t) => t.body) : null} builtIn={all.filter((p) => isTrackerProp(p) && isOpenable(p))} builtInOn={ids} {...(onChat ? { onChat } : {})} onBack={() => setPicking(false)} /></div>;
  if (libOpened && lib.load.state === "ready") return <div className="msn-trk" data-part="scene.messenger.trackers"><LibraryDetail ctx={ctx} data={lib.load.data} tracker={libOpened} edit={lib.edit} running={lib.running} onBack={() => setOpenLib(null)} /></div>;
  if (opened) return <div className="msn-trk" data-part="scene.messenger.trackers"><Detail prop={opened} ctx={ctx} chat={chat} {...(onChat ? { onChat } : {})} onBack={() => setOpenId(null)} /></div>;
  return (
    <div className="msn-trk" data-part="scene.messenger.trackers">
      <div className="msn-trk-top">
        <span className="msn-trk-sum" data-part="scene.messenger.trackers.summary">{trackersSummary(shown.length + (linked.length > 0 && lib.load.state === "ready" ? lib.load.data.trackers.length : linked.length), director && { on: director.on, autoUpdate: director.settings.autoUpdate, every: director.settings.every })}</span>
        <IconButton data-part="scene.messenger.trackers.settings" variant="quiet" size="sm" icon="lucide:settings" label="Panel AI settings" aria-pressed={gear} onClick={() => setGear(!gear)} />
      </div>
      {gear ? (
        <div className="msn-trk-set" data-part="scene.messenger.trackers.settings.view">
          <p className="dr-note-line" role="status"><Ic name="lucide:settings" size={14} />Panel AI settings. They mirror the Story Director.<span className="dr-note-x"><Button variant="quiet" size="sm" onClick={() => setGear(false)}>Back</Button></span></p>
          {dm.load.state === "ready" && <AutoUpdate ctx={ctx} chat={chat} panel={dm.load.panel} save={dm.settings} {...(onChat ? { onChat } : {})} />}
          {dm.load.state === "failed" && <p className="dr-note-line bad" role="alert">{dm.load.why}<span className="dr-note-x"><Button size="sm" onClick={dm.reload}>Try again</Button></span></p>}
        </div>
      ) : (
        <>
          {director && shown.length > 0 && (
            <p className="dr-note-line" role="status" data-part="scene.messenger.trackers.update-line">
              <Ic name="lucide:refresh-cw" size={14} />
              <span>{director.on && director.settings.autoUpdate ? "Updated by the Story Director after your replies." : "Trackers change only when you edit or Refresh them."}</span>
              <span className="dr-note-x"><Button variant="quiet" size="sm" onClick={openDirectorSettings}>Change in Story Director</Button></span>
            </p>
          )}
          <div className="msn-trk-list" data-part="scene.messenger.trackers.list">
            {shown.length === 0 && linked.length === 0 && <p className="msn-trk-empty">No tracker is switched on in this scene.</p>}
            {linked.length > 0 && lib.load.state === "loading" && <p className="msn-trk-empty" role="status">Loading the trackers...</p>}
            {lib.load.state === "failed" && linked.length > 0 && <p className="dr-note-line bad" role="alert">{lib.load.why}<span className="dr-note-x"><Button size="sm" onClick={lib.reload}>Try again</Button></span></p>}
            {linked.length > 0 && lib.load.state === "ready" && <VirtualRows items={lib.load.data.trackers} keyOf={(t) => t.id} estimate={LIBRARY_CARD_PX} gap={8} render={(t) => <LibraryCard tracker={t} onOpen={() => setOpenLib(t.id)} />} />}
            {shown.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (p) => <Card key={p.id} prop={p} ctx={ctx} chat={chat} onOpen={() => open(p)} />)}
          </div>
          <Button data-part="scene.messenger.trackers.pick.open" size="sm" icon="lucide:plus" onClick={() => setPicking(true)}>Add or remove trackers</Button>
        </>
      )}
      <footer className="msn-trk-foot" data-part="scene.messenger.trackers.footer">
        {more > 0 && <span>{more} more {more === 1 ? "tracker" : "trackers"} available</span>}
        <Button data-part="scene.messenger.trackers.manage" variant="quiet" size="sm" icon="lucide:puzzle" onClick={openDirectorSettings}>Manage features</Button>
      </footer>
    </div>
  );
}
