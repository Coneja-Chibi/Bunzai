/**
 * The parts of the Story Director panel that do not depend on how it is framed: the dark-stage empty state, the four note lines, the Reset DM confirm and the tab's body. The Full Chat
 * pop-out kind (director-panel.tsx) and the Messenger panel (messenger/panels/director) both draw these, so the copy, the writers and the edit lock are written once.
 */
import type { JSX } from "react";
import { Button, IconButton } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { protect } from "../../../../_shared/protected-control";
import type { DirectorState } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import type { DirectorTabId } from "./director-core";
import type { DirectorLive } from "./director-live";
import type { DirectorData } from "./use-director-panel";
import { ActivityTab } from "./tab-activity";
import { AnalysisTab } from "./tab-analysis";
import { ArcsTab } from "./tab-arcs";
import { DebugTab } from "./tab-debug";
import { StoryTab } from "./tab-story";

export const hasStory = (s: DirectorState): boolean => s.turn !== undefined || s.chapters.length > 0 || s.arcs.length > 0 || s.recentAnalysis.length > 0;

export function Dark(): JSX.Element {
  return (
    <div className="dr-empty" data-part="scene.director.empty">
      <span className="dr-empty-ic"><Ic name="lucide:compass" size={32} /></span>
      <h3>The Stage Is Dark</h3>
      <p>Send a message and the Director takes its place behind the curtain.</p>
    </div>
  );
}

/** The notes under the toolbar: reading an earlier turn, the Director off, a plan in flight, a plan that failed, and the last edit's refusal. */
export function DirectorNotes({ viewing, turn, on, live, note, onDismiss }: { viewing: boolean; turn: number; on: boolean; live: DirectorLive; note: string | null; onDismiss(): void }): JSX.Element {
  return (
    <>
      {viewing && <p className="dr-note-line" role="status" data-part="scene.director.readonly">Reading turn {turn}. Edits are off until you jump to latest.</p>}
      {!on && <p className="dr-note-line" role="status">The Story Director is off for this scene. What it saved stays here.</p>}
      {live.planning && <p className="dr-note-line live" role="status"><Ic name="lucide:loader-circle" size={14} />The Director is planning this reply.</p>}
      {live.failed && !live.planning && <p className="dr-note-line bad" role="alert" data-part="scene.director.failed">No directive for the last reply: {live.failed}</p>}
      {note && <p className="dr-note-line bad" role="alert">{note}<span className="dr-note-x"><IconButton size="sm" label="Dismiss" icon="lucide:x" onClick={onDismiss} /></span></p>}
    </>
  );
}

/** The Reset DM confirm; Reset writes `edit({ op: "reset" })` and the card closes whether or not it landed (a refusal shows as the note). */
export function ResetConfirm({ busy, edit, onClose }: { busy: boolean; edit: DirectorData["edit"]; onClose(): void }): JSX.Element {
  return (
    <div className="dr-confirm" role="alertdialog" aria-label="Reset the Story Director" data-part="scene.director.reset">
      <p><b>Reset the Story Director?</b> Chapters, arcs, seeds, hidden arcs and notes are cleared from this reply on, and the Director starts again on the next one. Earlier replies keep the story they were written with; the activity feed stays.</p>
      <div><Button variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
        <span {...protect("director-reset")}><Button variant="danger" size="sm" disabled={busy} onClick={() => void edit({ op: "reset" }, "The Story Director could not be reset. Reload this story before trying again.").then(onClose)}>Reset DM</Button></span></div>
    </div>
  );
}

/** The open tab's body: the feed always, the empty stage when nothing is saved yet, else the tab. `locked` turns every edit control off (a save in flight, or an earlier turn on show). */
export function DirectorBody({ chatId, tab, panel, now, locked, edit }: { chatId?: string; tab: DirectorTabId; panel: DirectorPanel; now: number; locked: boolean; edit: DirectorData["edit"] }): JSX.Element {
  const { state } = panel;
  return (
    <div key={tab} className="dr-tabpanel" role="tabpanel" data-director-panel={tab}>
      {tab === "activity" ? <ActivityTab entries={state.activity} now={now} locked={locked} onClear={() => void edit({ op: "clear-activity" }, "The activity log could not be cleared. Reload this story before trying again.")} />
        : !hasStory(state) ? <Dark />
        : tab === "story" ? <StoryTab state={state} chatId={chatId} />
        : tab === "arcs" ? <ArcsTab state={state} locked={locked} onResolve={(arcId) => void edit({ op: "resolve-arc", id: arcId }, "Couldn't save the resolved arc.")} />
        : tab === "analysis" ? <AnalysisTab state={state} />
        : <DebugTab panel={panel} onEdit={edit} locked={locked} />}
    </div>
  );
}
