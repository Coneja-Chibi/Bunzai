/**
 * The Trackers panel's one read of the library trackers a scene links (ctx.api.getSceneTrackers: every value at the take's tip and the reply that last changed each, in one call), and the
 * person's edits of them (ctx.api.editSceneTracker). It reads again whenever the scene page publishes a new take version (scene-signals.ts: a reply landing, a swipe, a regenerate and an
 * edit of a message each move it; the chat's `updatedAt` moves for neither a swipe nor a regenerate) and when the linked list changes; nothing is read while no tracker is linked.
 * Reads and edits are ordered: a read that started before a newer read, or before the latest edit started or landed, is dropped, so a slow read never puts back what an edit just changed;
 * a read dropped because of an edit is followed by one fresh read once the edits have settled, so the last thing shown is always a read that started after the last write.
 * Edits go one after another, each on the version the last one answered with. While a turn is answering here an edit is refused with a sentence (the server refuses it too); a refused edit
 * comes back as a sentence and the panel reads again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { SceneTrackers } from "../../../../../../studio/scene-trackers";
import type { TrackerEditInput } from "../../../../../../studio/tracker-edit";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { AppContext } from "../../../../../app-contract";
import { useSceneSignals } from "../../../scene-signals";

export type LibraryLoad = { state: "loading" } | { state: "ready"; data: SceneTrackers } | { state: "failed"; why: string };

export interface LibraryTrackers {
  load: LibraryLoad;
  /** Whether a reply is being written here: the edit controls wait for it. */
  running: boolean;
  /** One edit of a linked tracker, in the update tool's shape; the sentence that says why when it is refused, else null. */
  edit(trackerId: string, update: TrackerEditInput["update"]): Promise<string | null>;
  reload(): void;
}

export const WAITING = "A reply is being written. Edits wait until it lands.";

export function useLibraryTrackers(ctx: AppContext, chat: Chat, linked: readonly string[]): LibraryTrackers {
  const [load, setLoad] = useState<LibraryLoad>({ state: "loading" });
  const [tick, setTick] = useState(0);
  const { version, running } = useSceneSignals(chat.id);
  const latest = useRef<SceneTrackers | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const runningRef = useRef(running);
  runningRef.current = running;
  /** A counter that numbers every read start and every edit start and landing, so a read can tell whether anything newer began or finished after it started. */
  const clock = useRef(0);
  const newestRead = useRef(0);
  const lastEdit = useRef(0);
  /** Edits in flight, and whether a read was dropped because of one (a fresh read is owed when they settle). */
  const pending = useRef(0);
  const owed = useRef(false);
  const key = linked.join(",");
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const hold = useCallback((next: LibraryLoad): void => { latest.current = next.state === "ready" ? next.data : null; setLoad(next); }, []);

  useEffect(() => {
    if (key === "") return;
    const at = ++clock.current;
    newestRead.current = at;
    /** Applies the answer when nothing newer began after this read; a read an edit overtook is replaced by a fresh one once the edits have settled. */
    const landed = (apply: () => void): void => {
      if (newestRead.current !== at) return;
      if (lastEdit.current < at) apply();
      else if (pending.current > 0) owed.current = true;
      else reload();
    };
    ctx.api.getSceneTrackers(chat.id).then(
      (data) => landed(() => hold({ state: "ready", data })),
      (e: unknown) => landed(() => hold({ state: "failed", why: toErrorMessage(e, "The trackers could not be read.") })),
    );
  }, [ctx.api, chat.id, version, chat.activeBranchId, key, tick, hold, reload]);

  const edit = useCallback((trackerId: string, update: TrackerEditInput["update"]): Promise<string | null> => {
    const run = async (): Promise<string | null> => {
      const data = latest.current;
      if (runningRef.current) return WAITING;
      if (!data?.tipId) return "Send a message first: a change stays with a reply.";
      lastEdit.current = ++clock.current;
      pending.current++;
      try {
        const fresh = await ctx.api.editSceneTracker({ chatId: chat.id, branchId: data.branchId, messageId: data.tipId, trackerId, update, expectedVersion: data.branchVersion });
        lastEdit.current = ++clock.current;
        hold({ state: "ready", data: fresh });
        return null;
      } catch (e) {
        lastEdit.current = ++clock.current;
        reload();
        return toErrorMessage(e, "That change could not be saved.");
      } finally {
        pending.current--;
        if (pending.current === 0 && owed.current) { owed.current = false; reload(); }
      }
    };
    const next = chain.current.then(run, run);
    chain.current = next;
    return next;
  }, [ctx.api, chat.id, hold, reload]);

  return { load, running, edit, reload };
}
