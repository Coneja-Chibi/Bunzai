/**
 * The input check and the merge for a scene's trackers, applied by every ChatStore implementation so they
 * cannot refuse or keep different things. A module's data is checked by the module itself (core/trackers), once, here.
 */
import { deepEq, isPlainObject } from "../../core/guards";
import { isTrackerModule, parseTrackerData } from "../../core/trackers";
import { StudioConflictError } from "../../studio/atomic-file";
import { DIRECTOR_RECEIPT_SIDE_MAX } from "../contracts/director-types";
import { TRACKER_CONTEXTS, TRACKER_EVERY_MAX, TRACKER_UNDONE_MAX, type ChatTrackerPatch, type ChatTrackers, type TrackerModule } from "../contracts/chat-tracker-types";
import { fail, isJson } from "./chat-rules";
import { isWhole } from "./scalar-rules";

/** The most one scene's trackers may seal into one cell. */
export const TRACKERS_BYTES_MAX = 1_000_000;

export function checkTrackerModule(module: unknown): TrackerModule {
  return typeof module === "string" && isTrackerModule(module) ? module : fail("module must be a tracker module");
}

/** The tracker's own automatic-update choice: only `on` (a boolean) and `every` (1 to 99). */
function checkAuto(a: unknown): void {
  if (!isPlainObject(a) || Object.keys(a).some((k) => k !== "on" && k !== "every")) fail("auto may hold only on and every");
  if (a.on !== undefined && typeof a.on !== "boolean") fail("auto.on must be true or false");
  if (a.every !== undefined && !(isWhole(a.every, 1) && a.every <= TRACKER_EVERY_MAX)) fail(`auto.every must be a whole number from 1 to ${TRACKER_EVERY_MAX}`);
}

/** An automatic update's record: the reply version, the turn and time, and both sides as bounded plain JSON. */
function checkUpdate(u: unknown): void {
  const keys = ["messageId", "swipeId", "turn", "at", "before", "after"];
  if (!isPlainObject(u) || Object.keys(u).some((k) => !keys.includes(k)) || !keys.every((k) => k in u)) fail("update needs a messageId, swipeId, turn, at, before and after");
  if (typeof u.messageId !== "string" || u.messageId.length === 0 || u.messageId.length > 80 || typeof u.swipeId !== "string" || u.swipeId.length === 0 || u.swipeId.length > 80) fail("update needs a message and a version");
  if (!isWhole(u.turn, 0) || !isWhole(u.at, 0)) fail("update turn and at must be whole numbers");
  for (const side of [u.before, u.after]) if (side === undefined || !isJson(side) || JSON.stringify(side).length > DIRECTOR_RECEIPT_SIDE_MAX) fail("update before and after must be JSON of a bounded size");
}

/** The updates the person undid: a bounded list of reply versions. */
function checkUndone(list: unknown): void {
  if (!Array.isArray(list) || list.length > TRACKER_UNDONE_MAX) fail(`undone must be a list of at most ${TRACKER_UNDONE_MAX}`);
  for (const u of list) {
    if (!isPlainObject(u) || Object.keys(u).some((k) => k !== "messageId" && k !== "swipeId" && k !== "at") || typeof u.messageId !== "string" || u.messageId.length === 0 || u.messageId.length > 80 || typeof u.swipeId !== "string" || u.swipeId.length === 0 || u.swipeId.length > 80 || !isWhole(u.at, 0)) fail("every undone update needs a messageId, swipeId and at");
  }
}

/** A patch whose keys are `context` (a valid choice or null), `data` (the module's state or null), `auto` (`{ on?, every? }` or null) and `expectedData` (a guard, not stored). An empty patch is allowed and changes nothing. */
export function checkTracker(module: TrackerModule, value: unknown): ChatTrackerPatch {
  if (!isPlainObject(value)) fail("a tracker change must be a plain object");
  for (const key of Object.keys(value)) if (key !== "context" && key !== "data" && key !== "auto" && key !== "update" && key !== "undone" && key !== "parked" && key !== "expectedData") fail(`a tracker change has an unknown field: ${key}`);
  const context = value["context"];
  if (context !== undefined && context !== null && !TRACKER_CONTEXTS.includes(context as never)) fail(`context must be one of ${TRACKER_CONTEXTS.join(", ")} or null`);
  const auto = value["auto"];
  if (auto !== undefined && auto !== null) checkAuto(auto);
  const update = value["update"];
  if (update !== undefined && update !== null) checkUpdate(update);
  const undone = value["undone"];
  if (undone !== undefined && undone !== null) checkUndone(undone);
  const parked = value["parked"];
  if (parked !== undefined && parked !== null) checkUndone(parked);
  const expected = value["expectedData"];
  if (expected !== undefined && !isJson(expected)) fail("expectedData must be JSON or null");
  let data = value["data"];
  if (data !== undefined && data !== null) {
    const parsed = parseTrackerData(module, data);
    if (parsed === null) fail(`data is not a state of the ${module} tracker`);
    data = parsed as never;
  }
  return {
    ...(context === undefined ? {} : { context: context as ChatTrackerPatch["context"] }), ...(data === undefined ? {} : { data: data as ChatTrackerPatch["data"] }),
    ...(auto === undefined ? {} : { auto: auto as ChatTrackerPatch["auto"] }), ...(update === undefined ? {} : { update: update as ChatTrackerPatch["update"] }), ...(undone === undefined ? {} : { undone: undone as ChatTrackerPatch["undone"] }), ...(parked === undefined ? {} : { parked: parked as ChatTrackerPatch["parked"] }), ...(expected === undefined ? {} : { expectedData: expected as ChatTrackerPatch["expectedData"] }),
  };
}

/** The scene's trackers after a checked patch to one module; null when nothing is left to keep. A patch that names `expectedData` is refused with a conflict, before anything changes, when the module's state is not that. */
export function mergeTrackers(old: ChatTrackers | undefined, module: TrackerModule, patch: ChatTrackerPatch): ChatTrackers | null {
  const before = old?.[module];
  if (patch.expectedData !== undefined && !deepEq(before?.data ?? null, patch.expectedData)) throw new StudioConflictError(`the ${module} tracker changed since it was read`);
  const update = patch.update === undefined ? before?.update : patch.update ?? undefined;
  const undone = patch.undone === undefined ? before?.undone : patch.undone ?? undefined;
  // A write of the state that is not the Story Director's (it names no update and no parked list) is the person's: nothing parked is ever applied over it.
  const handEdit = patch.data !== undefined && patch.update === undefined && patch.parked === undefined;
  const parkedNow = patch.parked === undefined ? (handEdit ? undefined : before?.parked) : patch.parked ?? undefined;
  const parked = parkedNow?.length ? parkedNow : undefined;
  const autoNow = patch.auto === undefined ? before?.auto : patch.auto ?? undefined;
  const auto = autoNow && Object.keys(autoNow).length > 0 ? autoNow : undefined;
  const context = patch.context === undefined ? before?.context : patch.context ?? undefined;
  const data = patch.data === undefined ? before?.data : patch.data ?? undefined;
  const entry = { ...(context ? { context } : {}), ...(auto === undefined ? {} : { auto }), ...(update === undefined ? {} : { update }), ...(undone === undefined ? {} : { undone }), ...(parked === undefined ? {} : { parked }), ...(data === undefined ? {} : { data }) };
  const next: ChatTrackers = { ...old };
  if (Object.keys(entry).length > 0) next[module] = entry; else delete next[module];
  if (Object.keys(next).length === 0) return null;
  if (JSON.stringify(next).length > TRACKERS_BYTES_MAX) fail(`the scene's trackers must stay under ${TRACKERS_BYTES_MAX} characters`);
  return next;
}
