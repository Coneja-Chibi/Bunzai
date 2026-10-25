/**
 * The scene's own changes that move which version of a reply is shown, or whether it is there at all, kept in step with the Story Director's tracker updates (plan 16): a round still running is
 * stopped and finished first, the change is made, and then the trackers carry only what the replies and versions that are shown now did (scene-tracker-undo.ts). A reply that is cut takes its
 * update with it, newest first, wherever the tracker still holds what the update left.
 */
import type { ChatStore, Message } from "../stage/contracts/chat-store";
import type { TrackerReceipt } from "../stage/contracts/director-types";
import { TRACKER_MODULES, TRACKER_UNDONE_MAX, type TrackerUndone } from "../stage/contracts/chat-tracker-types";
import { cancelTrackerRound } from "./scene-director-trackers";
import { reconcileTrackers, syncTrackersToShown, undoUpdate } from "./scene-tracker-undo";

type Chats = Pick<ChatStore, "fork" | "getChat" | "setTracker" | "getDirector" | "putDirector" | "readMessagesBefore" | "selectTranscriptSwipe" | "cutMessages" | "cutSwipe">;
type Guard = { expectedVersion: number };

/** Shows another version of a reply, then makes the trackers carry that version's update and none other. */
export async function selectKeepingTrackers(chats: Chats, chatId: string, branchId: string, messageId: string, index: number, guard: Guard): ReturnType<ChatStore["selectTranscriptSwipe"]> {
  await cancelTrackerRound(chatId);
  const target = await chats.selectTranscriptSwipe(chatId, branchId, messageId, index, guard);
  if (target) await syncTrackersToShown(chats, chatId, messageId);
  return target;
}

/** Removes one version of a reply softly; the trackers follow the version that shows afterwards. */
export async function cutVersionKeepingTrackers(chats: Chats, chatId: string, messageId: string, swipeId: string, guard: Guard): ReturnType<ChatStore["cutSwipe"]> {
  await cancelTrackerRound(chatId);
  const cut = await chats.cutSwipe(messageId, swipeId, guard);
  if (cut) await syncTrackersToShown(chats, chatId, messageId);
  return cut;
}

/** The receipts of the shown versions of these replies, newest first. */
async function receiptsOf(chats: Chats, chatId: string, messages: readonly Pick<Message, "id">[]): Promise<TrackerReceipt[]> {
  const out: TrackerReceipt[] = [];
  for (const m of [...messages].reverse()) {
    const snap = await chats.getDirector(chatId, m.id);
    if (snap && snap.messageId === m.id) out.push(...(snap.state.trackerUpdates ?? []));
  }
  return out;
}

/** Cuts a message, or it and everything after it; each cut reply's update is undone where its tracker still holds what the update left, then any update left on a reply that is gone. */
export async function cutKeepingTrackers(chats: Chats, chatId: string, branchId: string, messageId: string, scope: "one" | "from", guard: Guard): ReturnType<ChatStore["cutMessages"]> {
  await cancelTrackerRound(chatId);
  const live = (await chats.readMessagesBefore(branchId, { limit: 5_000, liveOnly: true })).messages;
  const at = live.findIndex((m) => m.id === messageId);
  const going = at < 0 ? [] : scope === "one" ? [live[at]!] : live.slice(at);
  const receipts = await receiptsOf(chats, chatId, going);
  const cut = await chats.cutMessages(branchId, messageId, scope, guard);
  if (!cut) return cut;
  // The tracker's own record of its update comes first (it is the newest and clears itself); the snapshots' receipts reach the older replies' updates.
  await reconcileTrackers(chats, chatId);
  for (const r of receipts) {
    const now = await chats.getChat(chatId);
    if (now) await undoUpdate(chats, chatId, r.module, { messageId, swipeId: "", turn: r.turn, at: r.at, before: r.before, after: r.after });
  }
  return cut;
}


/**
 * Forks the scene at a message (the caller's `fork`). The copy has new message and version ids, so when the fork becomes the active take each tracker's update (and each update the person
 * undid) is pointed at the copy that holds the same version: the message at the same place in the copy, the version at the same position in it. One whose reply the copy does not hold is
 * undone, since the fork does not have that reply.
 */
export async function forkKeepingTrackers<T extends { id: string } | null>(chats: Chats, chatId: string, fork: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  await cancelTrackerRound(chatId);
  const was = (await chats.getChat(chatId))?.activeBranchId;
  const take = await fork();
  const chat = take && was ? await chats.getChat(chatId) : null;
  if (!take || !was || !chat?.trackers || chat.activeBranchId !== take.id) return take;
  const originals = (await chats.readMessagesBefore(was, { limit: 5_000, liveOnly: true })).messages;
  const copies = (await chats.readMessagesBefore(take.id, { limit: 5_000, liveOnly: true })).messages;
  const copyOf = (messageId: string, swipeId: string): { messageId: string; swipeId: string } | undefined => {
    const at = originals.findIndex((m) => m.id === messageId);
    const orig = originals[at];
    const copy = copies[at];
    const swipe = orig && copy && copy.role === orig.role ? copy.swipes[orig.swipes.findIndex((x) => x.id === swipeId)] : undefined;
    return copy && swipe ? { messageId: copy.id, swipeId: swipe.id } : undefined;
  };
  for (const module of TRACKER_MODULES) {
    const entry = chat.trackers[module];
    if (!entry?.update && !entry?.undone && !entry?.parked) continue;
    const moved = entry.update ? copyOf(entry.update.messageId, entry.update.swipeId) : undefined;
    const update = entry.update && moved ? { ...entry.update, ...moved } : undefined;
    // The copy's identity is ADDED to the original's: an Undo holds in both takes, and the original version is parked so switching back to its take brings its update back.
    const both = (list: readonly TrackerUndone[] | undefined): TrackerUndone[] | undefined =>
      list && [...list, ...list.flatMap((u) => { const c = copyOf(u.messageId, u.swipeId); return c ? [{ ...u, ...c }] : []; })].slice(-TRACKER_UNDONE_MAX);
    const undone = both(entry.undone);
    const held = both(entry.parked);
    const parked = update && entry.update ? [...(held ?? []), { messageId: entry.update.messageId, swipeId: entry.update.swipeId, at: now() }].slice(-TRACKER_UNDONE_MAX) : held;
    await chats.setTracker(chatId, module, { ...(update ? { update } : {}), ...(undone ? { undone } : {}), ...(parked ? { parked } : {}) });
  }
  await reconcileTrackers(chats, chatId);
  return take;
}
