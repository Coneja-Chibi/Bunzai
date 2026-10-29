/**
 * The Props trackers' state as a scene's pages read and write it (docs/reference/scene-state.md). A module's state is the slot `tracker.<module>`; this is the one place that turns it into the
 * module data a panel draws (`readTrackerStates`: the data at the take's tip, and the last update a reply's version made by itself, for the panel's Undo line) and turns a panel's write
 * back into deltas (`writeTrackerStates`). There is one writer here, the person, and it goes through the store's message door (`recordMessageDeltas`), never the settings blob: a panel edit, Cast, Ready, Clear, Undo,
 * and anything they click or accept (Generate, Refresh, a card's Refresh) is written on the take's tip message, so it survives swiping and regenerating that message. Only the Story Director's automatic
 * round is a generated write, tied to the reply version it is about (scene-director-trackers.ts).
 * A write is the change from the data the panel computed it from, and the data a panel computes from is the module's REPAIRED read (a cut can leave fields that each fit and together break a rule; core/trackers
 * `repairOf` brings it inside), so a write never carries a value it did not read.
 * Several modules in one write are one store call, all or nothing (Cast spends from Stats and notes the cast in the Spellbook together). Refused with a sentence when a turn is running in the scene,
 * when the take moved on since the page read it, or when the data is not a state of the module.
 */
import { deepEq } from "../core/guards";
import { fold, foldInto, heldAs } from "../core/scene-state/fold";
import type { Delta, SceneState } from "../core/scene-state/types";
import { TRACKER_STATE_MODULES, hasTrackerState, parseTrackerData, readTrackerData, trackerDataIn, trackerDeltas, trackerHeldIn, trackerOverlay, trackerRawIn, trackerSlotId, trackerUnreadable } from "../core/trackers";
import { slotOf } from "../generated/slots";
import type { Chat, ChatStore, JsonValue } from "../stage/contracts/chat-store";
import type { TrackerModule } from "../stage/contracts/chat-tracker-types";
import { isStudioConflictError, StudioConflictError } from "./atomic-file";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { turnRunning } from "./scene-turn-running";
import { firstLive } from "./scene-trackers";

/** What the person is told when a reply is being written: the turn has already read the state it builds from. */
export const TURN_RUNNING = "A reply is being written, so nothing was changed. Try again when it lands.";
/** What the person is told when the take moved on since the panel read it. */
export const MOVED_ON = "The scene moved on since this was read, so nothing was changed. Try again.";

/** The last change a reply's version made to a module on its own (a generated write: only the Story Director's round makes one): where, when, and the module's data before and after it (`null`: none). */
export interface TrackerUpdateLine { messageId: string; number: number; at: number; before: JsonValue | null; after: JsonValue | null }

/** The Props trackers at a take's tip: each module's data (absent while nothing was written), the update lines, and the branch version and tip message a write must name back. */
export interface TrackerStates {
  branchId: string;
  branchVersion: number;
  tipId: string | null;
  data: Partial<Record<TrackerModule, JsonValue>>;
  /** The modules whose saved state could not be read at all (nothing in it is salvageable): their data is absent and the panel says so. */
  unreadable: TrackerModule[];
  updates: Partial<Record<TrackerModule, TrackerUpdateLine>>;
}

type Reader = Pick<ChatStore, "readMessagesBefore" | "readMessages" | "sceneState" | "sceneDeltas">;

const SLOT_PREFIX = "tracker.";

/** The module's data in a state as plain JSON, `null` when it holds none. */
const dataOf = (module: TrackerModule, state: SceneState, chat: Pick<Chat, "trackers">): JsonValue | null => (trackerDataIn(module, state, chat.trackers?.[module]?.subs) as JsonValue | undefined) ?? null;

/**
 * The last update each module got from a reply's version on its own, by one pass over the take's tracker deltas. The pass only finds, by the generated layer's index, the last message that wrote each module
 * and folds the take in place; the data before and after an update is read (and repaired) once per module, at its last message, never at every one.
 */
async function updatesOf(chats: Reader, chat: Pick<Chat, "trackers">, branchId: string): Promise<TrackerStates["updates"]> {
  const start = await firstLive(chats, branchId);
  const range = start ? await chats.sceneDeltas(branchId, start, undefined, [SLOT_PREFIX]) : null;
  const out: TrackerStates["updates"] = {};
  if (!range) return out;
  const last = new Map<TrackerModule, number>();
  range.messages.forEach((m, i) => {
    for (const d of m.deltas.slice(m.generatedFrom, m.personFrom)) {
      const module = TRACKER_STATE_MODULES.find((x) => trackerSlotId(x) === d.slot);
      if (module) last.set(module, i);
    }
  });
  if (last.size === 0) return out;
  const acc: SceneState = { ...range.before };
  const copied = new Set<string>();
  range.messages.forEach((m, i) => {
    if (m.deltas.length === 0) return;
    const here = [...last].filter(([, at]) => at === i).map(([module]) => module);
    if (here.length > 0) {
      const afterOwn = fold(acc, m.deltas.slice(0, m.generatedFrom), slotOf);
      const generated = m.deltas.slice(m.generatedFrom, m.personFrom);
      const afterGenerated = fold(afterOwn, generated, slotOf);
      for (const module of here) {
        const mine = generated.filter((d) => d.slot === trackerSlotId(module));
        out[module] = { messageId: m.messageId, number: i + 1, at: Math.max(...mine.map((d) => d.at)), before: dataOf(module, afterOwn, chat), after: dataOf(module, afterGenerated, chat) };
      }
    }
    foldInto(acc, m.deltas, slotOf, copied);
  });
  return out;
}

/** The Props trackers of a take, or null when the take is gone. */
export async function readTrackerStates(chats: Reader, chat: Pick<Chat, "trackers">, branchId: string): Promise<TrackerStates | null> {
  const tail = await chats.readMessagesBefore(branchId, { limit: 1, liveOnly: true });
  const state = await chats.sceneState(branchId);
  if (tail.branchVersion === null || !state) return null;
  const entries = trackerOverlay(chat.trackers, state);
  const unreadable = TRACKER_STATE_MODULES.filter((m) => trackerUnreadable(m, state, chat.trackers?.[m]?.subs));
  const data = Object.fromEntries(TRACKER_STATE_MODULES.flatMap((m) => (entries[m]?.data === undefined || unreadable.includes(m) ? [] : [[m, entries[m]!.data]])));
  return { branchId, branchVersion: tail.branchVersion, tipId: tail.messages[0]?.id ?? null, data, unreadable, updates: await updatesOf(chats, chat, branchId) };
}

/** The fields and rows of a module the person edited on this reply, by the name a delta's path starts with; null when the reply is not on the take. */
export async function editedByPerson(chats: Pick<ChatStore, "sceneDeltas">, branchId: string, messageId: string, module: TrackerModule): Promise<Set<string> | null> {
  const range = await chats.sceneDeltas(branchId, messageId, messageId, [trackerSlotId(module)]);
  const mine = range?.messages[0];
  return mine ? new Set(mine.deltas.slice(mine.personFrom).map((d) => d.path[0]!)) : null;
}

/**
 * What of a planned automatic change to a module may be written on a reply: everything but the fields and rows the person edited there (the person wins), and nothing at all when what is left would
 * change, through the module's repair, what the person's edit reads as (a lower maximum would bring an HP they set inside it). `left` names what was left alone; `blocked` says which kept field would change which edit.
 */
export async function keepUnedited(chats: Pick<ChatStore, "sceneDeltas">, branchId: string, messageId: string, module: TrackerModule, planned: readonly Delta[], state: SceneState, subs: Readonly<Record<string, boolean>> | undefined): Promise<{ kept: Delta[]; left: string[]; blocked: string[] } | null> {
  const theirs = await editedByPerson(chats, branchId, messageId, module);
  if (!theirs) return null;
  const kept = planned.filter((d) => !theirs.has(d.path[0]!));
  const left = [...new Set(planned.filter((d) => theirs.has(d.path[0]!)).map((d) => d.path[0]!))];
  if (kept.length === 0 || theirs.size === 0) return { kept, left, blocked: [] };
  const mine = [...theirs].map((p): Delta => ({ slot: trackerSlotId(module), path: [p], removed: true, at: 0 }));
  const readOf = (s: SceneState): Delta[] => trackerHeldIn(module, trackerDataIn(module, s, subs), mine);
  const was = readOf(state);
  const blocked = kept.flatMap((d) => {
    const moved = readOf(fold(state, [d], slotOf));
    const edits = [...theirs].filter((_, i) => !deepEq(moved[i], was[i]));
    return edits.length > 0 ? [`${d.path[0]!} would change your edit of ${edits.join(", ")}`] : [];
  });
  return { kept: blocked.length > 0 ? [] : kept, left, blocked };
}

/**
 * One module's new data: the whole state the panel computed, or null to clear it. `base` is the data the panel computed it from (null: the module had none): the write is the change from `base`
 * to `data`, so only the fields and rows the person changed are written, and it is refused when another writer changed one of those since the panel read it. Left out, the change is judged against what the take shows now.
 */
export interface TrackerWrite { module: TrackerModule; data: JsonValue | null; base?: JsonValue | null }

export interface TrackerWriteInput {
  chatId: string;
  branchId: string;
  /** The tip's live message: the one the write belongs to. */
  messageId: string;
  writes: TrackerWrite[];
  /** The branch version the page read; a different one means the take moved on. */
  expectedVersion: number;
}

/** What a write of the trackers' state needs of the chat store. */
export type TrackerChats = Reader & Pick<ChatStore, "getChat" | "listBranches" | "recordMessageDeltas">;
type Writer = TrackerChats;

export async function writeTrackerStates(chats: Writer, input: TrackerWriteInput, now: () => number): Promise<TrackerStates> {
  const chat = await chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene is gone");
  if (!(await chats.listBranches(chat.id)).some((b) => b.id === input.branchId)) throw new StudioNotFoundError("that take is gone");
  if (turnRunning(chat.id)) throw new StudioConflictError(TURN_RUNNING);
  const tail = await chats.readMessagesBefore(input.branchId, { limit: 1, liveOnly: true });
  if (tail.messages[0]?.id !== input.messageId) throw new StudioConflictError(MOVED_ON);
  const state = await chats.sceneState(input.branchId);
  if (!state) throw new StudioNotFoundError("that take is gone");
  const entries = trackerOverlay(chat.trackers, state);
  const at = now();
  const deltas: Delta[] = [];
  const expect: Delta[] = [];
  for (const { module, data, base } of input.writes) {
    if (!hasTrackerState(module)) throw new StudioValidationError(`${module} keeps no state to write`);
    const after = data === null ? undefined : parseTrackerData(module, data);
    if (data !== null && after === null) throw new StudioValidationError(`that is not a state of the ${module} tracker`);
    const subs = chat.trackers?.[module]?.subs;
    // Nothing in the saved state can be read: the change replaces what was saved, so it is judged against what is stored.
    const unreadable = trackerUnreadable(module, state, subs);
    const current = entries[module]?.data;
    const before = unreadable ? trackerRawIn(module, state, subs) : base === undefined ? current : base ?? undefined;
    const planned = trackerDeltas(module, before, after, at);
    // The panel computed from the repaired state it saw; the server's own repaired view must agree with it at every place the write changes, else the take moved on.
    if (base !== undefined && !unreadable && !deepEq(trackerHeldIn(module, base ?? undefined, planned), trackerHeldIn(module, current, planned))) throw new StudioConflictError(MOVED_ON);
    deltas.push(...planned);
    // The guard describes what is STORED at those places (a repaired value is not what the store holds), so the store's transaction still catches a write that lands between this read and its write.
    expect.push(...heldAs(state, planned, slotOf));
  }
  if (deltas.length > 0) {
    try {
      if (!(await chats.recordMessageDeltas(input.branchId, input.messageId, deltas, { expectedVersion: input.expectedVersion, expect }))) throw new StudioNotFoundError("that message is gone");
    } catch (e) {
      throw isStudioConflictError(e) ? new StudioConflictError(MOVED_ON) : e;
    }
  }
  const fresh = await readTrackerStates(chats, chat, input.branchId);
  if (!fresh) throw new StudioNotFoundError("that take is gone");
  return fresh;
}

/**
 * The person's Undo of a module's last update by a reply's version: the data goes back to what it was before the update, written as the person's own edit on that reply, so it holds through swiping
 * and regenerating it. Only while the module still holds exactly what the update left; a change since is theirs and the Undo refuses, changing nothing.
 */
export async function undoTrackerUpdate(chats: Writer, chatId: string, module: TrackerModule, messageId: string, now: () => number): Promise<void> {
  const chat = await chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  const states = await readTrackerStates(chats, chat, chat.activeBranchId);
  const u = states?.updates[module];
  if (!states || !u || u.messageId !== messageId) throw new StudioNotFoundError("the Story Director has no update of that tracker to undo");
  // Compared as the module reads them, so a module that has had its defaults written is the module that was never written.
  const same = (a: JsonValue | null | undefined, b: JsonValue | null): boolean => deepEq(readTrackerData(module, a ?? undefined), readTrackerData(module, b ?? undefined));
  // Back where it was before the update: there is nothing left to take back (an Undo already made).
  if (same(states.data[module], u.before)) throw new StudioNotFoundError("the Story Director has no update of that tracker to undo");
  if (!same(states.data[module], u.after)) throw new StudioConflictError(`the ${module} tracker has changed since the Story Director updated it, so it was left as it is`);
  const deltas = trackerDeltas(module, u.after ?? undefined, u.before ?? undefined, now());
  try {
    if (!(await chats.recordMessageDeltas(states.branchId, messageId, deltas, { expectedVersion: states.branchVersion }))) throw new StudioNotFoundError("that message is gone");
  } catch (e) {
    throw isStudioConflictError(e) ? new StudioConflictError(`the ${module} tracker has changed since the Story Director updated it, so it was left as it is`) : e;
  }
}
