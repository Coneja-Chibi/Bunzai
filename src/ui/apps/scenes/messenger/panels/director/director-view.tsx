/**
 * The Story Director as the Messenger draws it (approved wireframe messenger-discord/panels.html section 4): the thread you read beside the chat. A quiet line under the frame's title
 * ("Turn 42 · chapter 3") with the gear (the Director's settings), More (Reset DM, with its confirm card) and Pop out, the turn stepper, the five tabs as one strip, then the tab.
 * It is the same panel as the Full Chat pop-out kind: the state, the edit lock and the notes come from use-director-view.ts, the tabs, the Reset confirm and the notes from director-shared.tsx,
 * and the settings view is the Props row's own `DirectorSettings`, so every writer is the one Full Chat uses. Not drawn because nothing backs them yet (map-panels.md section 4): the Suggested
 * actions buttons, the two mood chips, the pacing meter, the Chapter update card, and the Director filter set of the Activity tab.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import { Button, IconButton, Tabs } from "../../../../../components/button";
import { Ic } from "../../../../../_shared/ic";
import { ThemeSlot } from "../../../../../_shared/theme-slot";
import { DIRECTOR_TONE } from "../../../props/story-director/director-panel";
import { currentChapter, DIRECTOR_TABS } from "../../../props/story-director/director-core";
import { DirectorBody, DirectorNotes, ResetConfirm } from "../../../props/story-director/director-shared";
import { DirectorSettings } from "../../../props/story-director/director-settings";
import { DirectorTour } from "../../../props/story-director/director-tour";
import { readingOf, useDirectorView } from "../../../props/story-director/use-director-view";
import type { DirectorState } from "../../../../../../stage/contracts/director-types";
import type { PopoutContext } from "../../../popout/popout-kind";
import { PopoutButton } from "../../../popout/popout-panel";
import { MenuList } from "../../frames/context-menu";


/** "Turn 42 · chapter 3": what the Director has said so far, or its plain name before the first reply. */
export function directorSubtitle(state: DirectorState): string {
  const chapter = currentChapter(state.chapters, state.currentChapterId);
  const parts = [state.turn ? `Turn ${state.turn}` : "", chapter ? `chapter ${chapter.number}` : ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Narrative oversight";
}

/** The overflow menu: one item today, Reset DM, which opens the confirm card. Closes on a pick, Esc or a press outside. */
function More({ onReset }: { onReset(): void }): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent): void => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <div ref={root} className="msn-menu-wrap">
      <IconButton data-part="scene.messenger.director.more" variant="quiet" size="sm" icon="lucide:ellipsis" label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <div className="msn-dr-menu">
          <MenuList label="Story Director" items={[{ id: "reset", label: "Reset DM", icon: "lucide:rotate-ccw", danger: true, onSelect: onReset }]} onDone={() => setOpen(false)}
            onEscape={() => { setOpen(false); root.current?.querySelector<HTMLElement>(`[data-part="scene.messenger.director.more"]`)?.focus(); }} />
        </div>
      )}
    </div>
  );
}

export function MessengerDirectorPanel({ ctx, chat, id, popOut, onChat }: PopoutContext): JSX.Element {
  const { data, live, viewAt, setViewAt, tab, setTab, note, setNote, busy, confirm, setConfirm, edit } = useDirectorView(ctx, chat);
  const [settings, setSettings] = useState(false);
  const root = (children: JSX.Element): JSX.Element => <div className="dr msn-dr" data-part="scene.messenger.director" style={{ "--w": DIRECTOR_TONE } as CSSProperties}><ThemeSlot id="scene.director" />{children}</div>;

  if (data.load.state === "loading") return root(<div className="dr-quiet short" role="status"><p>Loading the Story Director...</p></div>);
  if (data.load.state === "failed") {
    return root(
      <p className="dr-note-line bad" role="alert" data-part="scene.messenger.director.error">
        <Ic name="lucide:circle-alert" size={14} /><span><b>Story Director error</b><br />{data.load.why}</span>
        <span className="dr-note-x"><Button size="sm" onClick={data.reload}>Try again</Button>{viewAt && <Button variant="quiet" size="sm" onClick={() => setViewAt(null)}>Jump to latest</Button>}</span>
      </p>,
    );
  }
  const { panel } = data.load;
  const { state } = panel;
  const { viewing, stops, at, go } = readingOf(panel, viewAt, setViewAt);
  const readOnly = busy || viewing;
  return root(
    <>
      <div className="msn-dr-bar" data-part="scene.messenger.director.tools">
        <span className="msn-dr-sub" data-part="scene.messenger.director.subtitle">{directorSubtitle(state)}</span>
        <span className="msn-dr-tools">
          <IconButton data-part="scene.messenger.director.settings" variant="quiet" size="sm" icon="lucide:settings" label="Director settings" aria-pressed={settings} onClick={() => setSettings(!settings)} />
          {!readOnly && panel.tip !== null && <More onReset={() => { setSettings(false); setConfirm(true); }} />}
          {popOut && <PopoutButton id={id} onClick={popOut} />}
        </span>
      </div>
      {settings ? (
        <div className="msn-dr-settings" data-part="scene.messenger.director.settings.view">
          <p className="dr-note-line" role="status"><Ic name="lucide:settings" size={14} />Director settings. Changes apply from the next reply.<span className="dr-note-x"><Button variant="quiet" size="sm" onClick={() => setSettings(false)}>Back</Button></span></p>
          <DirectorSettings ctx={ctx} chat={chat} {...(onChat ? { onChat } : {})} />
        </div>
      ) : (
        <>
          {confirm && <ResetConfirm busy={busy} edit={edit} onClose={() => setConfirm(false)} />}
          {stops.length > 1 && (
            <div className="msn-dr-hist" data-part="scene.messenger.director.history">
              <IconButton variant="quiet" size="sm" label="Previous turn" icon="lucide:chevron-left" disabled={at <= 0} onClick={() => go(at - 1)} />
              <span>{viewing ? `${at + 1} / ${stops.length}` : "Latest"}</span>
              <IconButton variant="quiet" size="sm" label="Next turn" icon="lucide:chevron-right" disabled={!viewing} onClick={() => go(at + 1)} />
              {viewing && <Button variant="quiet" size="sm" onClick={() => setViewAt(null)}>Jump to latest</Button>}
            </div>
          )}
          <DirectorNotes viewing={viewing} turn={state.turn ?? at + 1} on={panel.on} live={live} note={note} onDismiss={() => setNote(null)} />
          {tab === "story" && <DirectorTour ctx={ctx} />}
          <div className="dr-tabs">
            <Tabs label="Story Director sections" data-part="scene.messenger.director.tabs" value={tab} onChange={setTab}
              items={DIRECTOR_TABS.map((t) => ({ value: t.id, "data-part": `scene.messenger.director.tab.${t.id}`, label: <><Ic name={t.icon} size={14} /><span>{t.label}</span></> }))} />
          </div>
          <DirectorBody chatId={chat.id} tab={tab} panel={panel} now={Date.now()} locked={readOnly} edit={edit} />
        </>
      )}
    </>,
  );
}
