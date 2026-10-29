/**
 * The Props wing (RoleCall's StageProps panel, StagecraftManagerPanel.tsx:285-347 and StagecraftExtensions.tsx:1024-1030,1893-1899): the
 * hero "Scene Augmentations / StageProps" with its Tooltips switch, "Built-In Props" (one row per registered prop, ChatStore rule 21), the
 * Legacy Trackers and Storyboards boxes (their modules are tiles) and "Coming Soon" (RoleCall's three inert rows). A prop with a panel opens
 * it here from its gear, in place of the list (RoleCall opens a wing of its own). Presentational: use-scene-props.ts owns the fetch and the
 * write queue, because the current "on" list is also needed outside this wing, to draw each on prop's Stage element on the stage itself.
 * The Tooltips choice is a per-user app pref (RoleCall kept it in the browser's localStorage).
 */
import { useEffect, useState, type JSX } from "react";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import { Button, Chip, IconButton } from "../../../components/button";
import { Ic } from "../../../_shared/ic";
import { TRACKER_PROP_PREFIX } from "../../../../stage/contracts/chat-store";
import { isTrackerModule, refreshSpecOf } from "../../../../core/trackers";
import { RefreshAllBox } from "./trackers/refresh/refresh-all";
import { SubFeatureList } from "./trackers/sub-features";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "./story-director/director-live";
import { PopoutSlot } from "../popout/popout-host";
import { WINGS } from "../scene-wings";
import { PropRow, SoonPropRow } from "./prop-row";
import { PropTile } from "./prop-tile";
import { SOON_PROPS } from "./props-soon";
import { CALENDAR_SOON } from "./trackers/storyboards";
import type { PropsLoad } from "./use-scene-props";
import type { SceneProp } from "./prop-contract";

const WING = WINGS.find((w) => w.id === "props")!;
export const TOOLTIPS_PREF = "scenes.props.tooltips";

/** The fold tab's meta line: RoleCall's "N active" (LeftWingPanelContent.tsx:266). */
export function propsTabMeta(list: readonly SceneProp[], load: PropsLoad): string {
  if (list.length === 0) return "No props yet";
  return `${load.state === "ready" ? load.on.length : 0} active`;
}

/** The two boxes RoleCall draws inside its Story Director drawer, drawn here under the rows (so they are reachable without opening the Story Director). */
const BOXES = [
  { group: "storyboard" as const, title: "Storyboards", note: "First-class story state. These feed the Compendium's Storyboards tab.", cls: "story" },
  { group: "legacy" as const, title: "Legacy Trackers", note: "optional", cls: "legacy" },
];

export function PropsWing({ list, load, onToggle, onRetry, prefs, host }: {
  list: readonly SceneProp[];
  load: PropsLoad;
  onToggle(id: string, on: boolean): void;
  onRetry(): void;
  prefs?: AppContext["prefs"];
  host?: { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void };
}): JSX.Element {
  const [tips, setTips] = useState(() => prefs?.get(TOOLTIPS_PREF) !== false);
  const [open, setOpen] = useState<string | null>(null);
  // "Change in Story Director" (the Booth's line, a tracker's menu): back to the list, at the Story Director's settings.
  const [reveal, setReveal] = useState(0);
  useEffect(() => { if (reveal > 0) document.querySelector('[data-part="props.story-director.settings"]')?.scrollIntoView?.({ block: "start" }); }, [reveal]);
  useEffect(() => {
    const show = (): void => { setOpen(null); setReveal((n) => n + 1); };
    window.addEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, show);
    return () => window.removeEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, show);
  }, []);
  if (load.state === "loading") return <div className="wbody"><div className="ed-empty">Loading props...</div></div>;

  if (load.state === "failed") {
    return (
      <div className="wbody">
        <header className="hero bad"><span className="hi"><Ic name="lucide:circle-alert" size={20} /></span><div><div className="eb">Props Error</div><h2>Could not <em>load</em></h2><p>{load.why}</p></div>
          <div className="hero-tools"><IconButton size="sm" label="Try again" icon="lucide:refresh-cw" onClick={onRetry} /></div>
        </header>
      </div>
    );
  }

  if (list.length === 0) {
    return <div className="wbody"><div className="quiet"><div><Ic name={WING.icon} size={32} /><div>No props yet.</div><small>{WING.blurb}</small></div></div></div>;
  }

  const on = new Set(load.on);
  const opened = open === null ? undefined : list.find((p) => p.id === open && on.has(p.id) && p.panel);
  if (opened && host) {
    return (
      <div className="wbody pw" data-open={opened.id} data-part="scene.props.panel">
        <div className="pw-back"><Button variant="quiet" size="sm" icon="lucide:chevron-left" onClick={() => setOpen(null)}>Props</Button></div>
        <PopoutSlot kind={opened.panel!} ctx={host.ctx} chat={host.chat} {...(host.onChat ? { onChat: host.onChat } : {})} />
      </div>
    );
  }

  const setTipsAndSave = (): void => { const next = !tips; setTips(next); prefs?.set(TOOLTIPS_PREF, next); };
  const gearOf = (p: SceneProp): (() => void) | undefined => (p.panel && host ? () => setOpen(p.id) : p.gear);
  const rows = list.filter((p) => p.group === undefined);
  return (
    <div className="wbody pw" data-part="scene.props">
      <div className="pw-heroWrap">
        <header className="hero">
          <span className="hi"><Ic name="lucide:lightbulb" size={20} /></span>
          <div><div className="eb">Scene Augmentations</div><h2>Stage<em>Props</em></h2>
            <p>Optional scene systems live here. Toggle the ones you want active; their wing icons and deeper panels appear only when enabled.</p></div>
        </header>
        <div className="pw-tipbtn"><Chip pressed={tips} title={`${tips ? "Disable" : "Enable"} detailed Stageprops tooltips`} onClick={setTipsAndSave}>Tooltips {tips ? "On" : "Off"}</Chip></div>
      </div>
      <div className="pw-label">Built-In Props</div>
      <div className="pw-list">
        {rows.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (p) => (
          <div key={p.id}>
            <PropRow prop={p} on={on.has(p.id)} tips={tips} onToggle={() => onToggle(p.id, !on.has(p.id))} {...(gearOf(p) ? { onGear: gearOf(p)! } : {})} />
            {on.has(p.id) && p.Sub && host && <div className="pw-sub"><p.Sub ctx={host.ctx} chat={host.chat} {...(host.onChat ? { onChat: host.onChat } : {})} /></div>}
          </div>
        ))}
      </div>
      {BOXES.map((box) => {
        const members = list.filter((p) => p.group === box.group);
        if (members.length === 0) return null;
        return (
          <div key={box.group} className={`pw-box ${box.cls}`} data-part={`scene.props.box.${box.group}`}>
            <div className="pw-box-head">
              <div><h4>{box.title}</h4>{box.group === "storyboard" && <p>{box.note}</p>}</div>
              <span className="pw-chip">{box.group === "storyboard" ? `${members.filter((p) => on.has(p.id)).length}/${members.length}` : box.note}</span>
            </div>
            {box.group === "legacy" && host && (
              <RefreshAllBox host={host} boards={members.flatMap((p) => {
                const m = p.id.slice(TRACKER_PROP_PREFIX.length);
                return on.has(p.id) && isTrackerModule(m) && refreshSpecOf(m) ? [{ module: m, label: p.name }] : [];
              })} />
            )}
            <div className="pw-grid">
              {members.map((p) => {
                const module = p.id.startsWith(TRACKER_PROP_PREFIX) ? p.id.slice(TRACKER_PROP_PREFIX.length) : "";
                const tracker = isTrackerModule(module) ? module : null;
                const tile = <PropTile key={p.id} prop={p} on={on.has(p.id)} tips={tips} onToggle={() => onToggle(p.id, !on.has(p.id))} {...(gearOf(p) ? { onGear: gearOf(p)! } : {})} {...(host && tracker ? { subOn: host.chat.trackers?.[tracker]?.subs ?? {} } : {})} />;
                return on.has(p.id) && p.subs && host && tracker
                  ? <div key={p.id} className={`pw-span2${box.group === "storyboard" ? " story" : ""}`}>{tile}<SubFeatureList ctx={host.ctx} chat={host.chat} {...(host.onChat ? { onChat: host.onChat } : {})} module={tracker} subs={p.subs} tone={p.tone} /></div>
                  : tile;
              })}
              {box.group === "storyboard" && (
                <div className="pw-tile story soon" aria-disabled="true" title={CALENDAR_SOON.why} aria-label={`${CALENDAR_SOON.name}: ${CALENDAR_SOON.why}`}>
                  <div className="pw-tile-head"><Ic name="lucide:clock" size={16} /><span className="pw-tile-name">{CALENDAR_SOON.name}</span><span className="pw-chip">Soon</span></div>
                  <p className="pw-tile-blurb">{CALENDAR_SOON.blurb}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {list.filter((p) => on.has(p.id) && p.note).map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (p) => <p className="prop-note" key={p.id}>{p.note}</p>)}
      <div className="pw-label">Coming Soon</div>
      <div className="pw-list">{SOON_PROPS.map((r) => <SoonPropRow key={r.id} row={r} tips={tips} />)}</div>
    </div>
  );
}
