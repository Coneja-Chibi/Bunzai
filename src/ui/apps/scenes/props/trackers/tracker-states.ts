/**
 * The Props trackers' state as the panels read it (studio/tracker-state.ts): ONE read of every module's data at the take's tip per scene and version, shared by every panel that is open (a scene-level
 * owner, the way scene-signals is shared, not one request per panel), and the one write. The read happens again when the take's version moves (a reply landing, a swipe, a regenerate, an edit of a
 * message each move it), when the take changes, and when the Story Director's background round finishes for this scene; the panels that ask for the same version in the same render share one request.
 * A write answers the trackers as they now stand and every panel of the scene shows it (the Spellbook's Cast shows at once in Stats). Writes go one after another across all panels, each on the
 * version the last answered with, so two quick changes never overtake each other. The owner lives while any panel of the scene uses it.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { TrackerStates, TrackerWrite } from "../../../../../studio/tracker-state";
import type { AppContext } from "../../../../app-contract";
import { useSceneSignals } from "../../scene-signals";

/** What the person is told when there is no reply to keep a change with. */
export const NO_REPLY = "Send a message first: a change stays with a reply.";

interface Owner {
  /** What the panels see: the trackers (null until the first read) and a counter that moves when a re-read is asked for. */
  snap: { states: TrackerStates | null; tick: number };
  /** The version, take and event the last request was made for, so the panels of one scene ask once. */
  stamp: string;
  seq: number;
  users: number;
  chain: Promise<unknown>;
  listeners: Set<() => void>;
}

const owners = new Map<string, Owner>();

function ownerOf(chatId: string): Owner {
  let o = owners.get(chatId);
  if (!o) { o = { snap: { states: null, tick: 0 }, stamp: "", seq: 0, users: 0, chain: Promise.resolve(), listeners: new Set() }; owners.set(chatId, o); }
  return o;
}
const emit = (o: Owner, next: Partial<Owner["snap"]>): void => { o.snap = { ...o.snap, ...next }; for (const l of [...o.listeners]) l(); };
/** Tests only: a panel mounted after the fake server's state was changed under it must read it again, which the shared owner would not do for the same version. */
export const forgetTrackerStates = (): void => owners.clear();
const never = (): (() => void) => () => undefined;
const none: Owner["snap"] = { states: null, tick: 0 };

export interface TrackerStatesHook {
  /** The trackers at the tip; null until the first read; a read that fails keeps the last ones. */
  states: TrackerStates | null;
  /** Writes one or more modules in one step; rejects with the sentence that says why when it is refused. */
  write(writes: TrackerWrite[]): Promise<TrackerStates>;
  reload(): void;
}

/** `on` false reads nothing and hears nothing: a Storyboard keeps no state, so its panel has no use for the trackers' read. */
export function useTrackerStates(ctx: AppContext, chat: Pick<Chat, "id" | "activeBranchId">, on = true): TrackerStatesHook {
  const id = chat.id;
  const owner = ownerOf(id);
  const snap = useSyncExternalStore(on ? (l) => { owner.listeners.add(l); return () => { owner.listeners.delete(l); }; } : never, on ? () => owner.snap : () => none, () => none);
  const { version } = useSceneSignals(id);
  const heard = useSyncExternalStore(on ? (listener) => ctx.pieces.subscribeList(listener) : never, on ? () => ctx.pieces.streamState().sceneTrackers : () => null, () => null);
  // Only an event for this scene reads again.
  const heardHere = heard?.chatId === id ? heard.seq : 0;

  useEffect(() => {
    if (!on) return;
    owner.users++;
    return () => { if (--owner.users === 0 && owners.get(id) === owner) owners.delete(id); };
  }, [on, id, owner]);

  useEffect(() => {
    if (!on) return;
    const stamp = [version, chat.activeBranchId, heardHere, snap.tick].join("|");
    if (owner.stamp === stamp) return;
    owner.stamp = stamp;
    const at = ++owner.seq;
    ctx.api.getTrackerStates(id).then((got) => { if (owner.seq === at) emit(owner, { states: got }); }, () => undefined);
  }, [on, owner, ctx.api, id, chat.activeBranchId, version, heardHere, snap.tick]);

  const reload = useCallback(() => emit(owner, { tick: owner.snap.tick + 1 }), [owner]);

  const write = useCallback((writes: TrackerWrite[]): Promise<TrackerStates> => {
    const run = async (): Promise<TrackerStates> => {
      const at = owner.snap.states;
      if (!at?.tipId) throw new Error(NO_REPLY);
      try {
        const done = await ctx.api.writeTrackerStates({ chatId: id, branchId: at.branchId, messageId: at.tipId, writes, expectedVersion: at.branchVersion });
        owner.seq++;
        emit(owner, { states: done });
        return done;
      } catch (e) {
        reload();
        throw e;
      }
    };
    const next = owner.chain.then(run, run);
    owner.chain = next;
    return next;
  }, [ctx.api, id, owner, reload]);

  return { states: snap.states, write, reload };
}
