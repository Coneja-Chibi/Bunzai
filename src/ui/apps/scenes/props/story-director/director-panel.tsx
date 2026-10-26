/**
 * The Story Director panel (RoleCall's right wing `story-director`, StoryDirectorWingPanel.tsx:340-538), as the Prop's pop-out kind: docked in the Props wing it opens from the row's gear, floating it
 * stays over the scene. The hero ("Turn n" or "Narrative oversight", "Story Director"), the toolbar (Reset DM), the five tabs (Story, Arcs, Analysis, Activity, Debug) with their glyphs over
 * their names, then the tab. RoleCall's turn-history stepper is drawn (earlier turns are read-only); Unpin is not, because Bunraku's wings have no pin. Every edit goes through the panel's
 * version (use-director-panel.ts), and the controls are off while one is being saved. The first-use strip is RoleCall's DM tour (DMTourOverlay.tsx) as a note, not an overlay.
 * The state it keeps (use-director-view.ts) and the parts that do not depend on the frame (director-shared.tsx) are shared with the Messenger's presentation of the same panel.
 */
import type { CSSProperties, JSX } from "react";
import { Button, IconButton, Tabs } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { protect } from "../../../../_shared/protected-control";
import { ThemeSlot } from "../../../../_shared/theme-slot";
import type { PopoutContext, PopoutKind } from "../../popout/popout-kind";
import { PopoutButton } from "../../popout/popout-panel";
import { DIRECTOR_TABS } from "./director-core";
import { DirectorBody, DirectorNotes, ResetConfirm } from "./director-shared";
import { DirectorTour } from "./director-tour";
import { readingOf, useDirectorView } from "./use-director-view";

export const DIRECTOR_TONE = "var(--deck-persona)";

export function DirectorPanelView({ ctx, chat, id, popOut }: PopoutContext): JSX.Element {
  const { data, live, viewAt, setViewAt, tab, setTab, note, setNote, busy, confirm, setConfirm, edit } = useDirectorView(ctx, chat);
  const root = (children: JSX.Element): JSX.Element => <div className="dr" data-part="scene.director" style={{ "--w": DIRECTOR_TONE } as CSSProperties}><ThemeSlot id="scene.director" />{children}</div>;

  if (data.load.state === "loading") return root(<div className="dr-quiet short" role="status"><p>Loading the Story Director...</p></div>);
  if (data.load.state === "failed") {
    return root(
      <header className="hero bad" role="alert"><span className="hi"><Ic name="lucide:circle-alert" size={20} /></span>
        <div><div className="eb">Story Director Error</div><h2>Could not <em>load</em></h2><p>{data.load.why}</p></div>
        <div className="hero-tools"><IconButton size="sm" label="Try again" icon="lucide:refresh-cw" onClick={data.reload} />{viewAt && <IconButton size="sm" label="Jump to latest" icon="lucide:skip-forward" onClick={() => setViewAt(null)} />}</div>
      </header>,
    );
  }
  const { panel } = data.load;
  const { state } = panel;
  const { viewing, stops, at, go } = readingOf(panel, viewAt, setViewAt);
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
            <IconButton size="sm" label="Previous turn" icon="lucide:chevron-left" disabled={at <= 0} onClick={() => go(at - 1)} />
            <span>{viewing ? `${at + 1} / ${stops.length}` : "Latest"}</span>
            <IconButton size="sm" label="Next turn" icon="lucide:chevron-right" disabled={!viewing} onClick={() => go(at + 1)} />
            {viewing && <Button variant="quiet" size="sm" onClick={() => setViewAt(null)}>Jump to latest</Button>}
          </span>
        )}
        <span className="dr-bar-r">
          {popOut && <PopoutButton id={id} onClick={popOut} />}
          <span {...protect("director-reset")}>
            <Button size="sm" icon="lucide:rotate-ccw" title="Reset DM state: re-evaluate mood, arcs & context from chat history" disabled={readOnly || panel.tip === null} onClick={() => setConfirm(true)}>Reset DM</Button>
          </span>
        </span>
      </div>
      {confirm && <ResetConfirm busy={busy} edit={edit} onClose={() => setConfirm(false)} />}
      <DirectorNotes viewing={viewing} turn={state.turn ?? at + 1} on={panel.on} live={live} note={note} onDismiss={() => setNote(null)} />
      <div className="dr-tabs">
        <Tabs label="Story Director sections" data-part="scene.director.tabs" value={tab} onChange={setTab}
          items={DIRECTOR_TABS.map((t) => ({ value: t.id, "data-part": `scene.director.tab.${t.id}`, label: <><Ic name={t.icon} size={14} /><span>{t.label}</span></> }))} />
      </div>
      <DirectorBody chatId={chat.id} tab={tab} panel={panel} now={Date.now()} locked={readOnly} edit={edit} />
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
