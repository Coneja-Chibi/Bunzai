/**
 * The Dramaturg's panel (specs/stage/dramaturg.md, "Surface"; RoleCall's right-wing `right-dramaturg`, the BTW panel docked): the conversation
 * about the scene, oldest first, each answer with the reads it made and its model; the answer being written, growing as it streams, with
 * Stop; a composer (Enter asks, Shift+Enter is a new line); and Clear, which asks first. It is the Prop's pop-out kind, docked in its own
 * right-rail wing or in the Props wing from the gear, and it can float. The answer in flight lives in dramaturg-live.ts, not here, so moving
 * the panel never loses it. Answers are drawn with the scene's own Prose renderer: model text, sanitized, never an HTML string.
 */
import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import type { DramaturgEntry, DramaturgRead } from "../../../../../stage/contracts/dramaturg-types";
import { DRAMATURG_QUESTION_MAX } from "../../../../../core/dramaturg/settings";
import { Button, IconButton } from "../../../../components/button";
import { InkDialog } from "../../../../components/ink-dialog";
import { VirtualRows } from "../../../../_shared/virtual-list/rows";
import { Ic } from "../../../../_shared/ic";
import { Prose } from "../../prose";
import { PopoutButton } from "../../popout/popout-panel";
import type { PopoutContext, PopoutKind } from "../../popout/popout-kind";
import { askDramaturg, clearDramaturg, loadDramaturg, stopDramaturg, useDramaturg } from "./dramaturg-live";

export const DRAMATURG_TONE = "var(--premiere-gold)";

/** RoleCall's three kinds of question, offered on an empty conversation: explanation, audit, projection. */
const STARTERS: readonly string[] = [
  "Why did the last reply go the way it did?",
  "Is this consistent with the character's card?",
  "What would the character plausibly do next?",
];

function Reads({ reads }: { reads: readonly DramaturgRead[] }): JSX.Element | null {
  if (reads.length === 0) return null;
  return <ul className="dmg-reads" aria-label="What it read">{reads.map(/* bounded-ok: at most 40 read receipts per answer */ (r, i) => <li key={`${r.tool}-${String(i)}`}><Ic name="lucide:search" size={11} />{r.summary}</li>)}</ul>;
}

function Turn({ entry }: { entry: DramaturgEntry }): JSX.Element {
  if (entry.role === "user") return <div className="dmg-q" data-part="scene.dramaturg.question"><b>You</b><p>{entry.text}</p></div>;
  return (
    <div className={`dmg-a${entry.failed ? " bad" : ""}`} data-part="scene.dramaturg.answer">
      <Reads reads={entry.reads ?? []} />
      {entry.text && <Prose text={entry.text} />}
      {entry.failed && <p className="dmg-failed" role="note"><Ic name="lucide:triangle-alert" size={12} />{entry.failed}</p>}
      {entry.model && <small className="dmg-meta">{entry.model}</small>}
    </div>
  );
}

function DramaturgPanelView({ ctx, chat, popOut }: PopoutContext): JSX.Element {
  const live = useDramaturg(ctx.api, chat.id);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const { panel, pending } = live;
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [panel?.thread.revision, pending?.text, pending?.reads.length]);

  const hero = (
    <header className="hero" data-part="scene.dramaturg.hero">
      <span className="hi"><Ic name="lucide:book-open" size={20} /></span>
      <div><div className="eb">Out of character</div><h2>The <em>Dramaturg</em></h2><p>Reads the scene, the card, the lore and the preset, and talks with you about them. Changes nothing.</p></div>
      <div className="hero-tools">
        {popOut && <PopoutButton id={dramaturgPanelPopout.id} onClick={popOut} />}
        {panel && panel.thread.entries.length > 0 && !pending && !asking && (
          <IconButton icon="lucide:trash-2" label="Clear the conversation" onClick={() => setAsking(true)} />
        )}
      </div>
    </header>
  );
  const root = (body: JSX.Element): JSX.Element => <div className="wbody dmg" data-part="scene.dramaturg">{hero}{body}</div>;

  if (!panel) {
    return root(live.error
      ? <div className="dmg-note bad" role="alert"><p>{live.error}</p><Button variant="quiet" size="sm" onClick={() => void loadDramaturg(ctx.api, chat.id)}>Try again</Button></div>
      : <p className="dmg-note" role="status">Loading...</p>);
  }
  if (!panel.on) return root(<p className="dmg-note">The Dramaturg is off for this scene. Turn it on in Props.</p>);

  const send = (text: string): void => {
    if (!text.trim() || pending) return;
    setDraft("");
    // A refusal (the conversation moved on, no model) gives the question back, unless something new was typed meanwhile.
    void askDramaturg(ctx.api, chat.id, text).then((sent) => { if (!sent) setDraft((now) => (now === "" ? text : now)); });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); }
  };
  const blocked = !panel.model ? "Pick a model for the scene in the AI wing, or one for the Dramaturg under its row in Props."
    : panel.busy && !pending ? "An answer for this scene is being written; it shows here once it is saved, or Stop ends it." : null;
  const entries = panel.thread.entries;

  return root(
    <>
      <p className="dmg-model" data-part="scene.dramaturg.model">
        <Ic name="lucide:cpu" size={12} />{panel.model ? panel.model.model : "No model"}
        <span>{panel.tools === "native" ? "Reads the scene with tools" : panel.tools === "none" ? "This model takes no tools: it answers from what it is given" : "Tool support unknown"}</span>
      </p>
      {asking && (
        <InkDialog ariaLabel="Clear the conversation" onDismiss={() => setAsking(false)}><div className="dmg-confirm">
          <p>Clear this conversation? The scene is not touched.</p>
          <Button variant="danger" size="sm" onClick={() => { setAsking(false); void clearDramaturg(ctx.api, chat.id); }}>Clear</Button>
          <Button variant="quiet" size="sm" autoFocus onClick={() => setAsking(false)}>Keep</Button>
        </div></InkDialog>
      )}
      <div className="dmg-log" ref={log} role="log" aria-live="polite" data-part="scene.dramaturg.log">
        {entries.length === 0 && !pending && (
          <div className="dmg-start">
            <p>Ask about the scene: a character&apos;s motive, whether a reply fits the card, what could plausibly come next. It answers with readings, never the next message.</p>
            {STARTERS.map(/* bounded-ok: three fixed starter questions */ (s) => <Button key={s} variant="quiet" block disabled={blocked !== null} onClick={() => send(s)}>{s}</Button>)}
          </div>
        )}
        <VirtualRows scroll={log} items={entries} keyOf={(entry) => entry.id} render={(entry) => <Turn entry={entry} />} estimate={160} gap={12} pick={false} />
        {pending && (
          <>
            <div className="dmg-q" data-part="scene.dramaturg.question"><b>You</b><p>{pending.question}</p></div>
            <div className="dmg-a live" data-part="scene.dramaturg.answer">
              <Reads reads={pending.reads} />
              {pending.text ? <Prose text={pending.text} /> : <p className="dmg-note" role="status"><Ic name="lucide:loader-circle" size={12} />Reading the scene...</p>}
            </div>
          </>
        )}
      </div>
      {live.error && <p className="ds-err" role="alert">{live.error}</p>}
      {blocked && <p className="dmg-note">{blocked}</p>}
      <form className="dmg-ask" data-part="scene.dramaturg.composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea rows={3} value={draft} maxLength={DRAMATURG_QUESTION_MAX} disabled={blocked !== null} aria-label="Ask the Dramaturg"
          placeholder="Ask about the scene. Enter asks, Shift+Enter is a new line." onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
        {pending || panel.busy
          ? <Button variant="secondary" onClick={() => void stopDramaturg(ctx.api, chat.id)}><Ic name="lucide:square" size={14} />Stop</Button>
          : <Button type="submit" variant="primary" disabled={blocked !== null || !draft.trim()}><Ic name="lucide:send" size={14} />Ask</Button>}
      </form>
    </>,
  );
}

export const dramaturgPanelPopout: PopoutKind = {
  id: "dramaturg.panel",
  title: "Dramaturg",
  noun: "The Dramaturg",
  icon: "lucide:book-open",
  width: 460,
  top: 140,
  render: (c) => <DramaturgPanelView {...c} />,
};
