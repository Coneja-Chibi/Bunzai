/**
 * Undoing the Story Director's tracker updates (plan 16): what a tracker carries is the update of ONE version of one reply (`ChatTrackerEntry.update`), and it must never outlive that version being
 * the shown one. Every undo here is module by module, writes only while the tracker still holds exactly what the update left (a change of the person's since is never overwritten), and clears the
 * record it undid. `reconcileTrackers` is that rule for a new turn, a cut, a take change; `syncTrackersToShown` also applies the update of the version that is shown now, where the tracker still
 * holds what that version started from; `undoTrackerUpdate` is the person's Undo. None of them writes a snapshot onto any message but the reply it is about.
 */
import { undoTarget } from "../core/director/tracker-round";
import { deepEq } from "../core/guards";
import { DIRECTOR_ACTIVITY_MAX, type DirectorActivity, type DirectorState } from "../stage/contracts/director-types";
import type { Chat, ChatStore, JsonValue } from "../stage/contracts/chat-store";
import { TRACKER_MODULES, TRACKER_UNDONE_MAX, type TrackerModule, type TrackerUpdate } from "../stage/contracts/chat-tracker-types";
import { StudioConflictError } from "./atomic-file";
import { publishSceneTrackers } from "./scene-events";
import { StudioNotFoundError } from "./errors";

export type UndoChats = Pick<ChatStore, "getChat" | "setTracker" | "getDirector" | "putDirector" | "readMessagesBefore">;
export type Line = Omit<DirectorActivity, "id">;

/** How many of the newest live messages are looked through for the reply an update belongs to. */
const WINDOW = 400;
/** How many of the newest messages of a take are looked through for its latest update. */
const TAKE_LOOK = 60;

/** The module's saved state as an update's side: none reads as null. */
export const dataOf = (chat: Pick<Chat, "trackers">, module: TrackerModule): JsonValue | null => chat.trackers?.[module]?.data ?? null;

/** Adds activity lines to a state, ids from its own counter. */
export function withLines(state: DirectorState, lines: readonly Line[]): DirectorState {
  const s = structuredClone(state);
  s.activity = [...s.activity, ...lines.map((l) => ({ ...l, id: `act-${s.nextId++}` }))].slice(-DIRECTOR_ACTIVITY_MAX);
  return s;
}

/** The version of a reply that is shown on the active take, "gone" when the reply is not on it (cut, or another take), "unknown" when it is older than what was looked through. */
export async function shownIn(chats: UndoChats, chat: Pick<Chat, "activeBranchId">, messageId: string): Promise<{ swipeId: string } | "gone" | "unknown"> {
  const page = await chats.readMessagesBefore(chat.activeBranchId, { limit: WINDOW, liveOnly: true });
  const m = page.messages.find((x) => x.id === messageId);
  const swipeId = m?.swipes[m.current]?.id;
  if (swipeId) return { swipeId };
  return page.beforeCount === 0 ? "gone" : "unknown";
}

/** Whether the person undid this version's update: it is never applied again. */
export const wasUndone = (chat: Pick<Chat, "trackers">, module: TrackerModule, messageId: string, swipeId: string): boolean =>
  chat.trackers?.[module]?.undone?.some((u) => u.messageId === messageId && u.swipeId === swipeId) === true;

/**
 * Undoes one update if the tracker still holds what it left; true when it did. The update's record is cleared either way it ends, since it can no longer be undone from the tracker.
 * `undoneAt` is the person's Undo: in the same write the version is added to the tracker's list of updates never to apply again.
 */
export async function undoUpdate(chats: UndoChats, chatId: string, module: TrackerModule, u: TrackerUpdate, opts: { undoneAt?: number; parkedAt?: number } = {}): Promise<boolean> {
  const { undoneAt, parkedAt } = opts;
  const chat = await chats.getChat(chatId);
  if (!chat) return false;
  const mine = chat.trackers?.[module]?.update;
  const clear = mine !== undefined && deepEq(mine, u) ? { update: null } : {};
  const target = undoTarget(dataOf(chat, module), u);
  try {
    if (!target) { if (mine && clear.update === null) await chats.setTracker(chatId, module, clear); return false; }
    const undone = undoneAt === undefined ? {} : { undone: [...(chat.trackers?.[module]?.undone ?? []), { messageId: u.messageId, swipeId: u.swipeId, at: undoneAt }].slice(-TRACKER_UNDONE_MAX) };
    // The system's own undo parks the version, so showing it again can bring it back; the person's Undo and the round's never do.
    const held = (chat.trackers?.[module]?.parked ?? []).filter((p) => !(p.messageId === u.messageId && p.swipeId === u.swipeId));
    const parked = parkedAt === undefined ? held : [...held, { messageId: u.messageId, swipeId: u.swipeId, at: parkedAt }].slice(-TRACKER_UNDONE_MAX);
    await chats.setTracker(chatId, module, { data: target.data, ...clear, ...undone, parked, expectedData: u.after });
    return true;
  } catch (error) {
    if (error instanceof StudioConflictError) return false;
    throw error;
  }
}

/** Whether the system parked this version's update (it took it back and may bring it back). */
const isParked = (chat: Pick<Chat, "trackers">, module: TrackerModule, messageId: string, swipeId: string): boolean =>
  chat.trackers?.[module]?.parked?.some((p) => p.messageId === messageId && p.swipeId === swipeId) === true;

/** Puts an update back where the tracker still holds what it started from, and takes it off the parked list. With `onlyParked` it does so only for a version the system parked. */
async function reapply(chats: UndoChats, chatId: string, module: TrackerModule, u: TrackerUpdate, onlyParked = false): Promise<boolean> {
  const chat = await chats.getChat(chatId);
  if (!chat || wasUndone(chat, module, u.messageId, u.swipeId) || (onlyParked && !isParked(chat, module, u.messageId, u.swipeId))) return false;
  const parked = (chat.trackers?.[module]?.parked ?? []).filter((p) => !(p.messageId === u.messageId && p.swipeId === u.swipeId));
  try {
    await chats.setTracker(chatId, module, { data: u.after, update: u, parked, expectedData: u.before });
    return true;
  } catch (error) {
    if (error instanceof StudioConflictError) return false;
    throw error;
  }
}

/**
 * The trackers carry no update of a version that is not the shown one: each tracker's update is undone when its reply is cut or on another take, when a different version of it is shown, or when
 * that reply is the one being replaced (`replacing`). Returns what to do if the new version never lands (put the same updates back where the trackers still hold what the undo left), or null
 * when nothing was undone.
 */
export async function reconcileTrackers(chats: UndoChats, chatId: string, replacing?: string, now: () => number = Date.now): Promise<(() => Promise<void>) | null> {
  const chat = await chats.getChat(chatId);
  if (!chat?.trackers) return null;
  const undone: { module: TrackerModule; update: TrackerUpdate }[] = [];
  for (const module of TRACKER_MODULES) {
    const update = chat.trackers[module]?.update;
    if (!update) continue;
    const shown = update.messageId === replacing ? null : await shownIn(chats, chat, update.messageId);
    const stale = shown === null || shown === "gone" || (shown !== "unknown" && shown.swipeId !== update.swipeId);
    if (stale && (await undoUpdate(chats, chatId, module, update, { parkedAt: now() }))) undone.push({ module, update });
  }
  if (undone.length === 0) return null;
  return async () => { for (const { module, update } of undone) await reapply(chats, chatId, module, update); };
}

/** Writes lines onto the reply's own snapshot when it can be (the reply is the take's last message); otherwise they are not kept, and nothing is written anywhere else. */
async function say(chats: UndoChats, chatId: string, messageId: string, lines: readonly Line[]): Promise<void> {
  const snap = await chats.getDirector(chatId, messageId);
  if (snap && snap.messageId === messageId) await chats.putDirector(chatId, messageId, withLines(snap.state, lines), { expectedVersion: snap.version }).catch(() => undefined);
}

/**
 * The reply `messageId` now shows another version (or was changed some other way): the trackers go back to carrying only what the shown version did. The update of any other version is undone
 * first, then the shown version's receipts are applied where the tracker still holds what that version started from; one it cannot apply is left alone and says so.
 */
export async function syncTrackersToShown(chats: UndoChats, chatId: string, messageId: string, now: () => number = Date.now): Promise<void> {
  await reconcileTrackers(chats, chatId);
  const chat = await chats.getChat(chatId);
  const shown = chat ? await shownIn(chats, chat, messageId) : "gone";
  const snap = typeof shown === "string" ? null : await chats.getDirector(chatId, messageId);
  if (typeof shown === "string" || !snap || snap.messageId !== messageId) return;
  const lines: Line[] = [];
  for (const r of snap.state.trackerUpdates ?? []) {
    const current = await chats.getChat(chatId);
    if (!current) return;
    const held = current.trackers?.[r.module]?.update;
    if (held && held.messageId === messageId && held.swipeId === shown.swipeId) continue;
    if (wasUndone(current, r.module, messageId, shown.swipeId)) continue;
    const update: TrackerUpdate = { messageId, swipeId: shown.swipeId, turn: r.turn, at: r.at, before: r.before, after: r.after };
    if (!isParked(current, r.module, messageId, shown.swipeId)) continue;
    if (!(await reapply(chats, chatId, r.module, update, true))) {
      lines.push({ at: now(), turn: r.turn, type: "tracker", result: "error", description: `The Story Director's update of ${r.module} for this version was not applied: the tracker has changed since` });
    }
  }
  if (lines.length > 0) await say(chats, chatId, messageId, lines);
}

/**
 * The person's Undo on a tracker's "Updated by the Story Director" line: the tracker goes back to before the update, only while it still holds what the update left (the panel shows the line
 * only then, so a conflict here is a race and changes nothing). One write clears the tracker's update with its state. The receipt then leaves the reply's own snapshot, with a line, when that
 * snapshot can be written (the reply is the take's last message); it is never written onto a later message.
 */
export async function undoTrackerUpdate(deps: { chats: UndoChats; now(): number }, chatId: string, module: TrackerModule, messageId: string): Promise<void> {
  const chat = await deps.chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  const u = chat.trackers?.[module]?.update;
  if (!u || u.messageId !== messageId) throw new StudioNotFoundError("the Story Director has no update of that tracker to undo");
  if (!(await undoUpdate(deps.chats, chatId, module, u, { undoneAt: deps.now() }))) throw new StudioConflictError(`the ${module} tracker has changed since the Story Director updated it, so it was left as it is`);
  publishSceneTrackers({ chatId, modules: [{ module, outcome: "undone" }] });
  const snap = await deps.chats.getDirector(chatId, messageId);
  if (!snap || snap.messageId !== messageId) return;
  const state = withLines(snap.state, [{ at: deps.now(), turn: u.turn, type: "tracker", result: "info", description: `Undid the Story Director's update of ${module}` }]);
  const left = state.trackerUpdates?.filter((r) => r.module !== module) ?? [];
  if (left.length > 0) state.trackerUpdates = left; else delete state.trackerUpdates;
  await deps.chats.putDirector(chatId, messageId, state, { expectedVersion: snap.version }).catch(() => undefined);
}

/**
 * The shown take's latest tracker update is carried after the scene moved onto a take (switched to, restored, or left behind by a delete): updates of replies the take does not hold are undone,
 * then the newest reply with an update in its snapshot is applied where the trackers still hold what it started from (never one the person undid).
 */
export async function syncTrackersToTake(chats: UndoChats, chatId: string): Promise<void> {
  await reconcileTrackers(chats, chatId);
  const chat = await chats.getChat(chatId);
  if (!chat) return;
  const page = await chats.readMessagesBefore(chat.activeBranchId, { limit: TAKE_LOOK, liveOnly: true });
  for (const m of [...page.messages].reverse()) {
    const snap = await chats.getDirector(chatId, m.id);
    if (snap && snap.messageId === m.id && snap.state.trackerUpdates?.length) { await syncTrackersToShown(chats, chatId, m.id); return; }
  }
}
