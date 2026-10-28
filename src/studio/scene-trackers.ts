/**
 * The library trackers a scene links, read for the Trackers panel (`GET /api/chats/library-trackers`): each one's piece, its value at the take's tip (the same read the turn's prompt
 * uses, studio/library-trackers.ts) and the reply that last changed it, with that reply's number as the Messenger counts messages (its place among the live ones). One read for all
 * the trackers: the tip, then one pass over the take's tracker deltas (ChatStore.sceneDeltas with the tracker slot prefixes), so a long take costs the tracker deltas and nothing else.
 * Read only. The person's own edit of a tracker is tracker-edit.ts.
 */
import { TRACKER_SLOT_PREFIXES, trackerSlot, type TrackerValue } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import type { Chat, ChatStore } from "../stage/contracts/chat-store";
import { linkedTrackers, type ReadTracker } from "./library-trackers";

/** The reply that last changed a tracker: its id and its number among the take's live messages. */
export interface TrackerLast { messageId: string; number: number }

/** One linked tracker: its piece, its value at the tip as it is read, and what last changed it. */
export interface SceneTracker { id: string; body: TrackerBody; value: TrackerValue; last: TrackerLast | null }

/** The linked trackers at the take's tip, with the branch version and tip message a write must name back. */
export interface SceneTrackers { branchId: string; branchVersion: number; tipId: string | null; trackers: SceneTracker[] }

/** The take's first live message: a cut one at the start is stepped over. Null when the take has none. */
async function firstLive(chats: Pick<ChatStore, "readMessages">, branchId: string): Promise<string | null> {
  for (let fromSeq: number | null = 1; fromSeq !== null;) {
    const page = await chats.readMessages(branchId, { fromSeq, limit: 1 });
    const message = page.messages[0];
    if (message && !message.cut) return message.id;
    fromSeq = page.nextSeq;
  }
  return null;
}

/** The scene's linked trackers at its active take's tip, or null when the scene is gone. */
export async function sceneTrackers(chats: ChatStore, read: ReadTracker | undefined, chat: Chat, branchId: string = chat.activeBranchId): Promise<SceneTrackers | null> {
  const tail = await chats.readMessagesBefore(branchId, { limit: 1, liveOnly: true });
  const state = await chats.sceneState(branchId);
  if (tail.branchVersion === null || !state) return null;
  const linked = await linkedTrackers(read, chat.prompting?.trackers, state);
  const start = linked.length > 0 ? await firstLive(chats, branchId) : null;
  const range = start ? await chats.sceneDeltas(branchId, start, undefined, TRACKER_SLOT_PREFIXES) : null;
  const slots = new Map(linked.map((t) => [trackerSlot(t.id, t.body), t.id]));
  const last = new Map<string, TrackerLast>();
  range?.messages.forEach((m, i) => { for (const d of m.deltas) { const id = slots.get(d.slot); if (id !== undefined) last.set(id, { messageId: m.messageId, number: i + 1 }); } });
  return { branchId, branchVersion: tail.branchVersion, tipId: tail.messages[0]?.id ?? null, trackers: linked.map((t) => ({ id: t.id, body: t.body, value: t.shown, last: last.get(t.id) ?? null })) };
}
