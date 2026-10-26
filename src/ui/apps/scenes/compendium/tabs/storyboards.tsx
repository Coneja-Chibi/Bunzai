/**
 * The Storyboards tab (RoleCall `DossierHub.tsx:520-974`, rc-world-comp-storyboards.png): a strip of what the AI is sent, a tile per Storyboard that is on
 * (Quest Board, Cast, Map, Renown; Live on the open one), and the open dossier below. RoleCall fills the tab from the book's entries and the Story
 * Director's journal; here from the entries alone (core/compendium/dossiers). With none on it says so, as RoleCall does. The strip's Events and Last Write
 * read that journal, so they are not drawn; Calendar waits for it too (props/trackers/storyboards).
 */
import { Segmented } from "../../../../components/button";
import { useEffect, useMemo, useState, type JSX } from "react";
import { buildDossier, normalizeProfile, type ContextMode, type DossierType } from "../../../../../core/compendium/dossiers";
import { storyboardIncludedByDefault as includedByDefault } from "../../../../../core/trackers";
import type { CompendiumEntry } from "../../../../../core/compendium";
import { TRACKER_PROP_PREFIX, type Chat } from "../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../app-contract";
import { STORYBOARDS } from "../../props/trackers/storyboards";
import { useTracker } from "../../props/trackers/use-tracker";
import { useSceneProps } from "../../props/use-scene-props";
import { AiPanel, StatRow } from "../storyboards/dossier-parts";
import { CastBody, MapBody, QuestsBody, RenownBody } from "../storyboards/dossier-views";
import { clearStoryboards, pendingStoryboards } from "../storyboards/storyboards-open";

function Panel({ ctx, chat, type, entries, onChat, onOpen }: { ctx: AppContext; chat: Chat; type: DossierType; entries: readonly CompendiumEntry[]; onChat?(chat: Chat): void; onOpen(entryId: string): void }): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, type, normalizeProfile);
  const included = (view.stored?.context ?? (includedByDefault(type) ? "always" : "never")) !== "never";
  const d = useMemo(() => buildDossier(type, entries, view.data), [type, entries, view.data]);
  const ai = (
    <AiPanel ai={d.ai} included={included} onOff={() => view.setContext("never", true)}
      onMode={(mode: ContextMode) => { view.apply((p) => ({ ...p, mode, radius: mode === "radius" && p.mode !== "radius" ? 8 : p.radius })); view.setContext("always", true); }}
      onRadius={(radius) => view.apply((p) => ({ ...p, radius }))} />
  );
  const open = onOpen;
  return (
    <div className="sb-panel" data-dossier={type}>
      <div className="sb-health">
        <div><span>AI Context</span><strong className={included ? "good" : ""}>{included ? `${view.data.mode} sent` : "off"}</strong></div>
        <div><span>Scope</span><strong>chat</strong></div>
      </div>
      {d.type === "quests" && <><StatRow tiles={[{ label: "Active", value: d.stats.active, tone: "ok" }, { label: "Blocked", value: d.stats.blocked, tone: "warn" }, { label: "Deadlines", value: d.stats.imminentDeadlines, tone: "danger" }, { label: "Linked Cast", value: d.stats.linkedCharacters, tone: "pink" }, { label: "Pressure", value: `${d.stats.failurePressure}%`, tone: "danger" }, { label: "Rewards", value: d.stats.rewardBacklog, tone: "gold" }]} /><QuestsBody d={d} open={open} ai={ai} /></>}
      {d.type === "cast" && <><StatRow tiles={[{ label: "Cast", value: d.stats.totalCast, tone: "pink" }, { label: "On Stage", value: d.stats.activeCast, tone: "ok" }, { label: "Offstage", value: d.stats.offstageCast, tone: "link" }, { label: "High Affinity", value: d.stats.highAffinity, tone: "ok" }, { label: "Hostile", value: d.stats.hostile, tone: "danger" }, { label: "Hidden", value: d.stats.hiddenState, tone: "macro" }]} /><CastBody d={d} open={open} ai={ai} /></>}
      {d.type === "map" && <><StatRow tiles={[{ label: "Known", value: d.stats.knownLocations, tone: "link" }, { label: "Visited", value: d.stats.visitedLocations, tone: "ok" }, { label: "Dangerous", value: d.stats.dangerousLocations, tone: "danger" }, { label: "Regions", value: d.stats.regions, tone: "macro" }]} /><MapBody d={d} open={open} ai={ai} /></>}
      {d.type === "renown" && <><StatRow tiles={[{ label: "Standings", value: d.stats.standings, tone: "macro" }, { label: "Hot", value: d.stats.hotStandings, tone: "warn" }, { label: "Wanted", value: d.stats.wantedStandings, tone: "danger" }, { label: "Banked", value: d.stats.favorsBanked, tone: "ok" }, { label: "Owed", value: d.stats.favorsOwed, tone: "warn" }, { label: "Regions", value: d.stats.regions, tone: "link" }]} /><RenownBody d={d} open={open} ai={ai} /></>}
      {view.error && <p className="trk-error" role="alert">{view.error}</p>}
    </div>
  );
}

export function Storyboards({ ctx, chat, entries, onChat, onOpen }: { ctx: AppContext; chat: Chat; entries: readonly CompendiumEntry[]; onChat?(chat: Chat): void; onOpen(entryId: string): void }): JSX.Element {
  const props = useSceneProps(ctx, chat.id);
  const [asked] = useState(pendingStoryboards);
  const [active, setActive] = useState<DossierType | null>(asked);
  useEffect(() => { clearStoryboards(); }, []);
  if (props.load.state === "loading") return <div className="cp-load">Loading Storyboards...</div>;
  if (props.load.state === "failed") return <div className="cp-load bad">{props.load.why}</div>;
  const on = new Set(props.load.on);
  const visible = STORYBOARDS.filter((d) => on.has(`${TRACKER_PROP_PREFIX}${d.type}`));
  if (visible.length === 0) {
    return <div className="cp-note" data-part="compendium.storyboards">No Storyboards are enabled for this chat. Turn on Quest Board, Cast, Map, or Renown in Props to use this panel.</div>;
  }
  const current = visible.find((d) => d.type === active) ?? visible[0]!;
  return (
    <div className="sb" data-part="compendium.storyboards">
      <div className="sb-pick">
        <Segmented label="Storyboards" value={current.type} onChange={setActive}
          items={visible.map((d) => ({ value: d.type, tone: "var(--stage-ok)", label: <><small>{d.name}</small><b style={{ color: d.tone }}>{current.type === d.type ? "Live" : "Open"}</b></> }))} />
      </div>
      <Panel key={current.type} ctx={ctx} chat={chat} type={current.type} entries={entries} {...(onChat ? { onChat } : {})} onOpen={onOpen} />
    </div>
  );
}
