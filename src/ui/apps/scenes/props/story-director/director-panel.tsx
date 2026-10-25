/**
 * The Story Director panel (RoleCall's right wing `story-director`, StoryDirectorWingPanel.tsx:340-538), as the Prop's pop-out kind: docked in the Props wing it opens from the row's gear, floating it
 * stays over the scene. The hero ("Turn n" or "Narrative oversight", "Story Director"), the toolbar (Reset DM), the five tabs (Story, Arcs, Analysis, Activity, Debug) with their glyphs over
 * their names, then the tab. RoleCall's turn-history stepper is drawn (earlier turns are read-only); Unpin is not, because Bunraku's wings have no pin. Every edit goes through the panel's
 * version (use-director-panel.ts), and the controls are off while one is being saved. The first-use strip is RoleCall's DM tour (DMTourOverlay.tsx) as a note, not an overlay.
 */
import { useEffect, useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../../_shared/ic";
import { protect } from "../../../../_shared/protected-control";
import { ThemeSlot } from "../../../../_shared/theme-slot";
import type { PopoutContext, PopoutKind } from "../../popout/popout-kind";
import { PopoutButton } from "../../popout/popout-panel";
import { DIRECTOR_TABS, type DirectorTabId } from "./director-core";
import { takeDirectorTab, useDirectorLive } from "./director-live";
import { ActivityTab } from "./tab-activity";
import { AnalysisTab } from "./tab-analysis";
import { ArcsTab } from "./tab-arcs";
import { DebugTab } from "./tab-debug";
import { StoryTab } from "./tab-story";
import { useDirectorPanel } from "./use-director-panel";
import { DirectorTour } from "./director-tour";
import type { DirectorState } from "../../../../../stage/contracts/director-types";

export const DIRECTOR_TONE = "var(--deck-persona)";
const hasStory = (s: DirectorState): boolean => s.turn !== undefined || s.chapters.length > 0 || s.arcs.length > 0 || s.recentAnalysis.length > 0;

function Dark(): JSX.Element {
  return (
    <div className="dr-empty" data-part="scene.director.empty">
      <span className="dr-empty-ic"><Ic name="lucide:compass" size={32} /></span>
      <h3>The Stage Is Dark</h3>
      <p>Send a message and the Director takes its place behind the curtain.</p>
    </div>
  );
}

export function DirectorPanelView({ ctx, chat, id, popOut }: PopoutContext): JSX.Element {
  const [viewAt, setViewAt] = useState<string | null>(null);
  const data = useDirectorPanel(ctx, chat, viewAt);
  const live = useDirectorLive(chat.id);
  const [tab, setTab] = useState<DirectorTabId>(() => takeDirectorTab(chat.id) ?? "story");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // A new reply, a new take or a finished plan moves the latest: back to it.
  useEffect(() => setViewAt(null), [live.rev, chat.updatedAt, chat.activeBranchId]);
  useEffect(() => { if (live.tab) { const asked = takeDirectorTab(chat.id); if (asked) setTab(asked); } }, [live.tab, chat.id]);

  const edit = async (e: Parameters<typeof data.edit>[0], words: string): Promise<string | null> => {
    setBusy(true);
    const why = await data.edit(e, words);
    setBusy(false);
    setNote(why);
    return why;
  };
  const root = (children: JSX.Element): JSX.Element => <div className="dr" data-part="scene.director" style={{ "--w": DIRECTOR_TONE } as CSSProperties}><ThemeSlot id="scene.director" />{children}</div>;

  if (data.load.state === "loading") return root(<div className="dr-quiet short" role="status"><p>Loading the Story Director...</p></div>);
  if (data.load.state === "failed") {
    return root(
      <header className="hero bad" role="alert"><span className="hi"><Ic name="lucide:circle-alert" size={20} /></span>
        <div><div className="eb">Story Director Error</div><h2>Could not <em>load</em></h2><p>{data.load.why}</p></div>
        <div className="hero-tools"><button type="button" className="tbtn" title="Try again" aria-label="Try again" onClick={data.reload}><Ic name="lucide:refresh-cw" size={14} /></button>{viewAt && <button type="button" className="tbtn" title="Jump to latest" aria-label="Jump to latest" onClick={() => setViewAt(null)}><Ic name="lucide:skip-forward" size={14} /></button>}</div>
      </header>,
    );
  }
  const { panel } = data.load;
  const { state } = panel;
  const now = Date.now();
  const viewing = panel.at !== null;
  const stops = panel.history;
  const at = viewAt === null ? stops.length - 1 : stops.findIndex((h) => h.messageId === viewAt);
  const go = (to: number): void => setViewAt(to >= stops.length - 1 ? null : (stops[to]?.messageId ?? null));
  const readOnly = busy || viewing;
  return root(
    <>
      <DirectorTour ctx={ctx} />
      <header className="hero">
        <span className="hi"><Ic name="mdi:script-text-outline" size={20} /></span>
        <div><div className="eb">{state.turn ? `Turn ${state.turn}` : "Narrative oversight"}</div><h2>Story <em>Director</em></h2><p>Chapter, arc, and pacing intelligence the DM keeps just behind the curtain.</p></div>
      </header>
      <div className="dr-bar" data-part="scene.director.tools">
        {stops.length > 1 && (
          <span className="dr-hist" data-part="scene.director.history">
            <button type="button" title="Previous turn" aria-label="Previous turn" disabled={at <= 0} onClick={() => go(at - 1)}><Ic name="lucide:chevron-left" size={16} /></button>
            <span>{viewing ? `${at + 1} / ${stops.length}` : "Latest"}</span>
            <button type="button" title="Next turn" aria-label="Next turn" disabled={!viewing} onClick={() => go(at + 1)}><Ic name="lucide:chevron-right" size={16} /></button>
            {viewing && <button type="button" className="jump" onClick={() => setViewAt(null)}>Jump to latest</button>}
          </span>
        )}
        <span className="dr-bar-r">
          {popOut && <PopoutButton id={id} onClick={popOut} />}
          <button type="button" {...protect("director-reset", "dr-btn reset")} title="Reset DM state: re-evaluate mood, arcs & context from chat history" disabled={readOnly || panel.tip === null} onClick={() => setConfirm(true)}>
            <Ic name="lucide:rotate-ccw" size={16} /><span>Reset DM</span>
          </button>
        </span>
      </div>
      {confirm && (
        <div className="dr-confirm" role="alertdialog" aria-label="Reset the Story Director" data-part="scene.director.reset">
          <p><b>Reset the Story Director?</b> Chapters, arcs, seeds, hidden arcs and notes are cleared from this reply on, and the Director starts again on the next one. Earlier replies keep the story they were written with; the activity feed stays.</p>
          <div><button type="button" className="dr-btn" onClick={() => setConfirm(false)}>Cancel</button>
            <button type="button" {...protect("director-reset", "dr-btn danger")} disabled={busy} onClick={() => void edit({ op: "reset" }, "The Story Director could not be reset. Reload this story before trying again.").then(() => setConfirm(false))}>Reset DM</button></div>
        </div>
      )}
      {viewing && <p className="dr-note-line" role="status" data-part="scene.director.readonly">Reading turn {state.turn ?? at + 1}. Edits are off until you jump to latest.</p>}
      {!panel.on && <p className="dr-note-line" role="status">The Story Director is off for this scene. What it saved stays here.</p>}
      {live.planning && <p className="dr-note-line live" role="status"><Ic name="lucide:loader-circle" size={14} />The Director is planning this reply.</p>}
      {live.failed && !live.planning && <p className="dr-note-line bad" role="alert" data-part="scene.director.failed">No directive for the last reply: {live.failed}</p>}
      {note && <p className="dr-note-line bad" role="alert">{note}<button type="button" className="dr-ico" aria-label="Dismiss" onClick={() => setNote(null)}><Ic name="lucide:x" size={12} /></button></p>}
      <div className="dr-tabs" role="tablist" data-part="scene.director.tabs">
        {DIRECTOR_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} data-part={`scene.director.tab.${t.id}`} onClick={() => setTab(t.id)}>
            <Ic name={t.icon} size={16} /><span>{t.label}</span>
          </button>
        ))}
      </div>
      <div key={tab} className="dr-tabpanel" role="tabpanel" data-director-panel={tab}>
        {tab === "activity" ? <ActivityTab entries={state.activity} now={now} locked={readOnly} onClear={() => void edit({ op: "clear-activity" }, "The activity log could not be cleared. Reload this story before trying again.")} />
          : !hasStory(state) ? <Dark />
          : tab === "story" ? <StoryTab state={state} />
          : tab === "arcs" ? <ArcsTab state={state} locked={readOnly} onResolve={(arcId) => void edit({ op: "resolve-arc", id: arcId }, "Couldn't save the resolved arc.")} />
          : tab === "analysis" ? <AnalysisTab state={state} />
          : <DebugTab panel={panel} onEdit={edit} locked={readOnly} />}
      </div>
    </>,
  );
}

export const directorPanelPopout: PopoutKind = {
  id: "director.panel",
  title: "Story Director",
  noun: "Story Director",
  icon: "mdi:script-text-outline",
  width: 460,
  top: 100,
  render: (c) => <DirectorPanelView {...c} />,
};
