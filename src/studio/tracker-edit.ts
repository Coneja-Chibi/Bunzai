/**
 * The person's own edit of a linked library tracker (`POST /api/chats/tracker-edit`): one update, in the shape the narrator's `update_trackers` tool takes (`row`, `remove`, `set`),
 * applied by the same core code (core/tracker.ts applyTrackerUpdates: the same clamps, the same `maxField` rule, a number out of range is held inside it, never refused) and written as
 * message-level deltas on the take's tip message (ChatStore.recordMessageDeltas), so the edit wins on that message and survives swiping and regenerating it (scene-state.md).
 * Refused whole, with a sentence, when the tracker is not one the scene links, or the take has moved on since the page read it: the version the page read goes to the store as the write's own guard, so the check and the write are one step (a message that is no longer the tip is the same case).
 */
import { heldAs } from "../core/scene-state/fold";
import { applyTrackerUpdates } from "../core/tracker";
import { slotOf } from "../generated/slots";
import type { ChatStore } from "../stage/contracts/chat-store";
import { isStudioConflictError, StudioConflictError, StudioNotFoundError, StudioValidationError } from "./errors";

import type { TurnRuntime } from "./scene-turn-runtime";
import { turnRunning } from "./scene-turn-running";
import { linkedTrackers, type ReadTracker } from "./library-trackers";
import { sceneTrackers, type SceneTrackers } from "./scene-trackers";

/** What the person is told when a reply is being written: the turn's own whole-row update would overwrite the edit. */
export const TURN_RUNNING = "A reply is being written, so nothing was changed. Try again when it lands.";
/** What the person is told when the take moved on since the panel read it. */
const MOVED_ON = "The scene moved on since this was read, so nothing was changed. Try again.";

/** What a person asks of one tracker: the tool's own update, without the tracker's name (the id names it). */
export interface TrackerEditInput {
  chatId: string;
  branchId: string;
  /** The tip's live message: the one the edit belongs to. */
  messageId: string;
  trackerId: string;
  update: { row?: unknown; remove?: unknown; set?: unknown };
  /** The branch version the page read; a different one means the take moved on. */
  expectedVersion: number;
}

/**
 * Applies the edit and answers the trackers as they now stand.
 */
export async function editSceneTracker(runtime: TurnRuntime, chats: ChatStore, read: ReadTracker | undefined, input: TrackerEditInput, now: () => number): Promise<SceneTrackers> {
  const chat = await chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene is gone");
  if (!(await chats.listBranches(chat.id)).some((b) => b.id === input.branchId)) throw new StudioNotFoundError("that take is gone");
  if (!chat.prompting?.trackers?.includes(input.trackerId)) throw new StudioValidationError("this scene does not use that tracker");
  if (turnRunning(runtime, chat.id)) throw new StudioConflictError(TURN_RUNNING);
  const tail = await chats.readMessagesBefore(input.branchId, { limit: 1, liveOnly: true });
  if (tail.messages[0]?.id !== input.messageId) throw new StudioConflictError(MOVED_ON);
  const state = await chats.sceneState(input.branchId);
  if (!state) throw new StudioNotFoundError("that take is gone");
  // Resolved from the scene's whole list the way a turn does it, so a tracker the turn leaves out (gone, unreadable, or another linked tracker has its name) is refused here too.
  const target = (await linkedTrackers(read, chat.prompting.trackers, state)).find((t) => t.id === input.trackerId);
  if (!target) throw new StudioValidationError("this scene cannot use that tracker: it is gone, unreadable, or another linked tracker has the same name");
  const applied = applyTrackerUpdates([target], { updates: [{ ...input.update, tracker: target.body.name }] }, now());
  if ("errors" in applied) throw new StudioValidationError(applied.errors.map((e) => e.replace(/^Item \d+: /, "")).join(" "));
  if (applied.deltas.length > 0) {
    try {
      if (!(await chats.recordMessageDeltas(input.branchId, input.messageId, applied.deltas, { expectedVersion: input.expectedVersion, expect: heldAs(state, applied.deltas, slotOf) }))) throw new StudioNotFoundError("that message is gone");
    } catch (e) {
      throw isStudioConflictError(e) ? new StudioConflictError(MOVED_ON) : e;
    }
  }
  const fresh = await sceneTrackers(chats, read, chat, input.branchId);
  if (!fresh) throw new StudioNotFoundError("that take is gone");
  return fresh;
}
