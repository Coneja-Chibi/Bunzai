/**
 * What the Messenger draws under each assistant reply besides its text: the tracker changes the reply made (approved wireframe premiere/scene-pieces.html, section 3) and the out-of-time line. The
 * changes come from ONE read of the changes route for the range of messages the page holds (`getTrackerChanges`, never one per message), read again whenever the scene page publishes a new take
 * version (scene-signals.ts: a reply landing, a swipe, a regenerate and an edit each move it, while the chat's `updatedAt` moves for neither a swipe nor a regenerate), so a swiped reply shows the
 * shown version's changes. The blocks already drawn stay until the new read lands (they are never blanked while it is out), and nothing is read while a reply is streaming. The scene's switch
 * (`ChatPrompting.trackerChanges`, absent = on) turns it all off, and the read is not made while the scene links no library tracker.
 *
 * The toast is for a reply that has just landed live, and it is driven by what the turn itself committed: the page hands in the message and version (swipe) from the turn's own done or stopped event
 * (`CommittedTurn`, use-scene-turn.ts), null for a turn that saved nothing. The first read at a version newer than the one the turn ran on settles it, whatever the outcome (so it is never left armed):
 * it fires only when that read shows the committed message and version as the tip, and the tip has toast-style changes; for a continue (same message, same version) only when those changes differ from
 * what was drawn when the turn began (a structural comparison, never JSON text). A turn that ends while no changes are read (Full Chat, the scene switch off, no tracker linked) is settled too. A cut, a swipe, an edit or a read that fails never fires it. It never fires on load or scroll. The marker under the reply opens it again. Each reply's block is
 * one element kept until its changes change, so a finished message does not redraw while the page does.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { Chat, Generation } from "../../../../../stage/contracts/chat-store";
import type { TrackerChanged } from "../../../../../studio/tracker-changes";
import type { AppContext } from "../../../../app-contract";
import { deepEq } from "../../../../../core/guards";
import { Toast } from "../../../../_shared/toast";
import { useSceneSignals } from "../../scene-signals";
import type { Row } from "../../scene-page-types";
import type { CommittedTurn } from "../../use-scene-turn";
import { selectedSwipe } from "../../use-scene-swipe-preview";
import { requestTrackerOpen } from "../panels/trackers/open-tracker";
import { splitByStyle, toastWords } from "./reply-changes-core";
import { ChangeBlock, OutOfTimeLine } from "./reply-changes";

export interface ReplyNotes {
  /** What goes under a reply: the cut-off line `lead`, its changes, then the out-of-time line of the version shown (`gen`). Null when there is nothing; `show` is false for a line being written, a person's own and a version only looked at. */
  foot(id: string, gen: Generation | undefined, show: boolean, lead: JSX.Element | null): JSX.Element | null;
  /** The notice for a reply that just landed, or null. */
  toast: JSX.Element | null;
}

type Read = { byMessage: ReadonlyMap<string, readonly TrackerChanged[]> };

export function useReplyNotes(a: { ctx: AppContext; chatId: string; chat: Chat | undefined; committed: CommittedTurn | null; rows: readonly Row[]; on: boolean; onInspect(): void }): ReplyNotes {
  const { ctx, chatId, chat, rows, on, onInspect } = a;
  const { version, running } = useSceneSignals(chatId);
  const [read, setRead] = useState<Read | null>(null);
  const [toastFor, setToastFor] = useState<string | null>(null);
  /** The version the running turn is on (kept current while it runs), what was drawn when it began, and the committed turn the latest read has not settled yet. */
  const started = useRef(version);
  const before = useRef<ReadonlyMap<string, readonly TrackerChanged[]> | null>(null);
  const drawn = useRef<ReadonlyMap<string, readonly TrackerChanged[]> | null>(null);
  const settled = useRef<CommittedTurn | null>(null);
  const wasRunning = useRef(running);
  const committed = useRef(a.committed);
  committed.current = a.committed;

  const msgs = useMemo(() => rows.flatMap((r) => (r.kind === "msg" ? [r] : [])), [rows]);
  const first = msgs[0]?.m.id;
  const tip = msgs.at(-1);
  const tipId = tip?.m.role === "assistant" ? tip.m.id : undefined;
  const branchId = chat?.activeBranchId;
  const showing = on && chat?.prompting?.trackerChanges !== false && (chat?.prompting?.trackers?.length ?? 0) > 0;
  const last = tip?.m.id;
  const tipSwipeId = tip ? selectedSwipe(tip.m)?.id : undefined;

  useEffect(() => { if (running) started.current = version; }, [running, version]);
  // No changes are read (Full Chat, the scene switch off, no tracker linked): the turn is settled all the same, so turning them on later never toasts a reply that landed earlier.
  useEffect(() => { if (!showing && a.committed && !running && version > started.current) settled.current = a.committed; }, [showing, a.committed, running, version]);
  useEffect(() => { if (!wasRunning.current && running) before.current = drawn.current; wasRunning.current = running; }, [running]);

  useEffect(() => {
    if (!showing || running || branchId === undefined || first === undefined || last === undefined) return;
    let live = true;
    ctx.api.getTrackerChanges(branchId, first, last).then(
      (answer) => {
        if (!live) return;
        const byMessage = new Map(answer.messages.map((m) => [m.messageId, m.trackers]));
        drawn.current = byMessage;
        setRead({ byMessage });
        const turn = committed.current;
        // At the version the turn ran on its save has not reached the page yet: leave it for the next read.
        if (!turn || settled.current === turn || version <= started.current) return;
        settled.current = turn;
        if (tipId !== turn.messageId || tipSwipeId !== turn.swipeId) return;
        const toasts = splitByStyle(byMessage.get(tipId) ?? []).toasts;
        if (toasts.length === 0) return;
        if (turn.kind === "continue" && deepEq(splitByStyle(before.current?.get(tipId) ?? []).toasts, toasts)) return;
        setToastFor(tipId);
      },
      () => { if (live) { settled.current = committed.current; setRead(null); } },
    );
    return () => { live = false; };
  }, [ctx.api, showing, running, branchId, first, last, tipId, tipSwipeId, version]);

  const open = useCallback((trackerId: string): void => requestTrackerOpen(chatId, trackerId), [chatId]);
  const current = showing ? read?.byMessage ?? null : null;
  const blocks = useMemo(() => {
    const out = new Map<string, JSX.Element>();
    for (const [id, trackers] of current ?? []) {
      out.set(id, <ChangeBlock key={id} trackers={trackers} onOpen={open} onMarker={() => setToastFor(id)} />);
    }
    return out;
  }, [current, open]);

  const foot = useCallback((id: string, gen: Generation | undefined, show: boolean, lead: JSX.Element | null): JSX.Element | null => {
    const block = on && show ? blocks.get(id) ?? null : null;
    const late = on && show && gen?.outOfTime ? <OutOfTimeLine macros={gen.outOfTime} onInspect={onInspect} /> : null;
    const parts = [lead, block, late].filter((p) => p !== null);
    // One part is returned as it is, so a reply with only its changes keeps the same element between renders.
    return parts.length === 0 ? null : parts.length === 1 ? parts[0]! : <>{lead}{block}{late}</>;
  }, [on, blocks, onInspect]);

  const toasts = toastFor === null ? [] : splitByStyle(current?.get(toastFor) ?? []).toasts;
  const words = toastWords(msgs.find((r) => r.m.id === toastFor)?.n ?? 0, toasts);
  const toast = toastFor !== null && words !== null
    ? <Toast message={words} actionLabel="Open" onAction={() => { open(toasts[0]!.trackerId); setToastFor(null); }} onDismiss={() => setToastFor(null)} />
    : null;
  return { foot, toast };
}
