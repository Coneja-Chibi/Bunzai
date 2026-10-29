/**
 * The input check and the merge for a scene's tracker SETTINGS, applied by every ChatStore implementation so they cannot refuse or keep different things. A module's
 * state is not here: it is the scene-state slot `tracker.<module>`, written as deltas (scene-state-rules.ts). What this keeps per module is its AI Context choice, its
 * automatic-update choice, its sub-feature switches and, for a Storyboard, its AI Context profile (the only data a Storyboard has).
 */
import { isPlainObject } from "../../core/guards";
import { isStoryboard, isTrackerModule, parseTrackerData } from "../../core/trackers";
import { subIds } from "../../core/trackers/subfeatures";
import { TRACKER_CONTEXTS, TRACKER_EVERY_MAX, type ChatTrackerEntry, type ChatTrackerPatch, type ChatTrackers, type TrackerModule } from "../contracts/chat-tracker-types";
import { fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";

/** The most one scene's tracker settings may seal into one cell. */
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

/** The sub-feature switches: only the module's own sub-features, each true or false. */
function checkSubs(module: TrackerModule, subs: unknown): void {
  if (!isPlainObject(subs)) fail("subs must be a plain object");
  const known = subIds(module);
  for (const [id, on] of Object.entries(subs)) if (!known.includes(id) || typeof on !== "boolean") fail(`${module} has no sub-feature ${id}, or it is not true or false`);
}

/** A patch whose keys are `context` (a valid choice or null), `auto` (`{ on?, every? }` or null), `subs` (the module's switches or null) and, for a Storyboard only, `data` (its profile or null). An empty patch is allowed and changes nothing. */
export function checkTracker(module: TrackerModule, value: unknown): ChatTrackerPatch {
  if (!isPlainObject(value)) fail("a tracker change must be a plain object");
  for (const key of Object.keys(value)) if (key !== "context" && key !== "data" && key !== "auto" && key !== "subs") fail(`a tracker change has an unknown field: ${key}`);
  const context = value["context"];
  if (context !== undefined && context !== null && !TRACKER_CONTEXTS.includes(context as never)) fail(`context must be one of ${TRACKER_CONTEXTS.join(", ")} or null`);
  const auto = value["auto"];
  if (auto !== undefined && auto !== null) checkAuto(auto);
  const subs = value["subs"];
  if (subs !== undefined && subs !== null) checkSubs(module, subs);
  let data = value["data"];
  if (data !== undefined && !isStoryboard(module)) fail(`${module} keeps its state in the scene's history; write it as state changes`);
  if (data !== undefined && data !== null) {
    const parsed = parseTrackerData(module, data);
    if (parsed === null) fail(`data is not a profile of the ${module} Storyboard`);
    data = parsed as never;
  }
  return {
    ...(context === undefined ? {} : { context: context as ChatTrackerPatch["context"] }), ...(data === undefined ? {} : { data: data as ChatTrackerPatch["data"] }),
    ...(auto === undefined ? {} : { auto: auto as ChatTrackerPatch["auto"] }), ...(subs === undefined ? {} : { subs: subs as ChatTrackerPatch["subs"] }),
  };
}

/** A stored entry's settings alone: a row written before state moved into slots may still carry a module's state and the Director's undo records, and none of that is read. */
export function keepSettings(module: TrackerModule, entry: ChatTrackerEntry & Record<string, unknown>): ChatTrackerEntry {
  const { context, auto, data } = entry;
  // A cell written before the state moved to its slot may carry switches the module no longer has; only its own are kept.
  const subs = isPlainObject(entry.subs) ? Object.fromEntries(Object.entries(entry.subs).filter(([k, v]) => subIds(module).includes(k) && typeof v === "boolean")) : undefined;
  return { ...(context ? { context } : {}), ...(auto ? { auto } : {}), ...(subs && Object.keys(subs).length > 0 ? { subs } : {}), ...(isStoryboard(module) && data !== undefined ? { data } : {}) };
}

/** The scene's tracker settings, each entry read as settings alone. */
export function settingsOf(trackers: ChatTrackers | undefined): ChatTrackers | undefined {
  if (!trackers) return undefined;
  const out: ChatTrackers = {};
  for (const [module, entry] of Object.entries(trackers) as [TrackerModule, ChatTrackerEntry][]) {
    const kept = keepSettings(module, entry as never);
    if (Object.keys(kept).length > 0) out[module] = kept;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The scene's tracker settings after a checked patch to one module; null when nothing is left to keep. */
export function mergeTrackers(old: ChatTrackers | undefined, module: TrackerModule, patch: ChatTrackerPatch): ChatTrackers | null {
  const before = settingsOf(old)?.[module];
  const autoNow = patch.auto === undefined ? before?.auto : patch.auto ?? undefined;
  const auto = autoNow && Object.keys(autoNow).length > 0 ? autoNow : undefined;
  const subsNow = patch.subs === undefined ? before?.subs : patch.subs ?? undefined;
  const subs = subsNow && Object.keys(subsNow).length > 0 ? subsNow : undefined;
  const context = patch.context === undefined ? before?.context : patch.context ?? undefined;
  const data = patch.data === undefined ? before?.data : patch.data ?? undefined;
  const entry = { ...(context ? { context } : {}), ...(auto === undefined ? {} : { auto }), ...(subs === undefined ? {} : { subs }), ...(data === undefined ? {} : { data }) };
  const next: ChatTrackers = { ...settingsOf(old) };
  if (Object.keys(entry).length > 0) next[module] = entry; else delete next[module];
  if (Object.keys(next).length === 0) return null;
  if (JSON.stringify(next).length > TRACKERS_BYTES_MAX) fail(`the scene's trackers must stay under ${TRACKERS_BYTES_MAX} characters`);
  return next;
}
