/**
 * The input checks and the merge for the Story Director's settings and snapshots, applied by every ChatStore implementation so they cannot refuse or
 * keep different things. A snapshot is checked for its shape, its caps and its size, not for the story's meaning: the Director's own core writes the meaning, and the person's edits go through it.
 */
import { isPlainObject } from "../../core/guards";
import {
  DIRECTOR_ACTIVITY_MAX, DIRECTOR_ANALYSIS_MAX, DIRECTOR_CAPS, DIRECTOR_COMMAND_MODES, DIRECTOR_CREATIVITY, DIRECTOR_INSTRUCTIONS_MAX, DIRECTOR_PERSONALITIES, DIRECTOR_STATE_BYTES_MAX, DIRECTOR_TEMPERATURE_MAX,
  DIRECTOR_ARCHIVE_MAX, DIRECTOR_CALLS_MAX, DIRECTOR_CALLS_MIN, DIRECTOR_EVERY_MAX, DIRECTOR_RECEIPT_SIDE_MAX, type DirectorArchive, type DirectorSettings, type DirectorSettingsPatch, type DirectorState,
} from "../contracts/director-types";
import { isTrackerModule } from "../../core/trackers";
import { TRACKER_MODULES } from "../contracts/chat-tracker-types";
import { checkConnection, fail, isJson } from "./chat-rules";
import { EFFORTS } from "./prompting-rules";
import { isWhole } from "./scalar-rules";

const KEYS = ["personality", "model", "reasoning", "commandMode", "temperature", "autoRetry", "creativity", "autoUpdate", "every", "callsPerReply", "instructions"] as const;
const oneOf = <T extends string>(key: string, v: unknown, list: readonly T[]): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fail(`${key} must be ${list.join(", ")} or null`));

/** A patch of known keys, each a valid value or null. An empty patch is allowed and changes nothing. */
export function checkDirectorSettings(value: unknown): DirectorSettingsPatch {
  if (!isPlainObject(value)) fail("director settings must be a plain object");
  for (const key of Object.keys(value)) if (!(KEYS as readonly string[]).includes(key)) fail(`director settings has an unknown field: ${key}`);
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    const v = value[key];
    if (v === undefined) continue;
    if (v === null) { out[key] = null; continue; }
    switch (key) {
      case "personality": out[key] = oneOf(key, v, DIRECTOR_PERSONALITIES); break;
      case "commandMode": out[key] = oneOf(key, v, DIRECTOR_COMMAND_MODES); break;
      case "creativity": out[key] = oneOf(key, v, DIRECTOR_CREATIVITY); break;
      case "reasoning": out[key] = oneOf(key, v, EFFORTS as unknown as readonly string[]); break;
      case "autoRetry": out[key] = typeof v === "boolean" ? v : fail("autoRetry must be true, false or null"); break;
      case "model": out[key] = checkConnection(v) ?? fail("model must be a connection or null"); break;
      case "temperature": out[key] = typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= DIRECTOR_TEMPERATURE_MAX ? v : fail(`temperature must be a number from 0 to ${DIRECTOR_TEMPERATURE_MAX}, or null`); break;
      case "autoUpdate": out[key] = typeof v === "boolean" ? v : fail("autoUpdate must be true, false or null"); break;
      case "every": out[key] = isWhole(v, 1) && v <= DIRECTOR_EVERY_MAX ? v : fail(`every must be a whole number from 1 to ${DIRECTOR_EVERY_MAX}, or null`); break;
      case "callsPerReply": out[key] = isWhole(v, DIRECTOR_CALLS_MIN) && v <= DIRECTOR_CALLS_MAX ? v : fail(`callsPerReply must be a whole number from ${DIRECTOR_CALLS_MIN} to ${DIRECTOR_CALLS_MAX}, or null`); break;
      case "instructions": out[key] = typeof v === "string" && v.length <= DIRECTOR_INSTRUCTIONS_MAX ? (v.trim() === "" ? null : v) : fail(`instructions must be text of at most ${DIRECTOR_INSTRUCTIONS_MAX} characters, or null`); break;
    }
  }
  return out as DirectorSettingsPatch;
}

/** Rows to add to the archive: notes and hidden arcs as the snapshot held them, each with an id, plain JSON, and a sensible size. */
export function checkArchiveItems(value: unknown): Partial<DirectorArchive> {
  if (!isPlainObject(value)) fail("archive items must be a plain object");
  for (const key of Object.keys(value)) if (key !== "notes" && key !== "hidden") fail(`archive items has an unknown field: ${key}`);
  const list = (what: "notes" | "hidden", limit: number): unknown[] => {
    const v = value[what];
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > DIRECTOR_ARCHIVE_MAX) fail(`${what} must be a list of at most ${DIRECTOR_ARCHIVE_MAX}`);
    for (const row of v) if (!isPlainObject(row) || typeof row.id !== "string" || row.id.length === 0 || row.id.length > 80 || !isJson(row) || JSON.stringify(row).length > limit) fail(`every archived ${what === "notes" ? "note" : "hidden arc"} needs an id and a reasonable size`);
    return v;
  };
  return { notes: list("notes", 5_000) as DirectorArchive["notes"], hidden: list("hidden", 30_000) as DirectorArchive["hidden"] };
}

/** The archive with the new rows added once each by id; null when it would pass DIRECTOR_ARCHIVE_MAX. */
export function mergeArchive(old: DirectorArchive | undefined, add: Partial<DirectorArchive>): DirectorArchive | null {
  const join = <T extends { id: string }>(a: readonly T[], b: readonly T[] | undefined): T[] => {
    const seen = new Set(a.map((x) => x.id));
    return [...a, ...(b ?? []).filter((x) => !seen.has(x.id))];
  };
  const out = { notes: join(old?.notes ?? [], add.notes), hidden: join(old?.hidden ?? [], add.hidden) };
  return out.notes.length > DIRECTOR_ARCHIVE_MAX || out.hidden.length > DIRECTOR_ARCHIVE_MAX ? null : out;
}

/** The settings after a checked patch; undefined when nothing is left to keep. */
export function mergeDirectorSettings(old: DirectorSettings | undefined, patch: DirectorSettingsPatch): DirectorSettings | undefined {
  const next: Record<string, unknown> = { ...old };
  for (const [key, v] of Object.entries(patch)) if (v === null) delete next[key]; else if (v !== undefined) next[key] = v;
  return Object.keys(next).length > 0 ? (next as DirectorSettings) : undefined;
}

/** The receipts of a reply's automatic tracker updates: one per module, each side plain JSON of a bounded size. */
function checkReceipts(list: unknown): void {
  if (!Array.isArray(list) || list.length > TRACKER_MODULES.length) fail("trackerUpdates must be a list with at most one receipt per tracker");
  const seen = new Set<string>();
  const keys = ["module", "before", "after", "turn", "at"];
  for (const r of list) {
    if (!isPlainObject(r) || Object.keys(r).some((k) => !keys.includes(k)) || !keys.every((k) => k in r)) fail("a tracker receipt needs a module, before, after, turn and at");
    if (typeof r.module !== "string" || !isTrackerModule(r.module) || seen.has(r.module)) fail("a tracker receipt needs one tracker module, once");
    seen.add(r.module);
    if (!isWhole(r.turn, 0) || !isWhole(r.at, 0)) fail("a tracker receipt's turn and at must be whole numbers");
    for (const side of [r.before, r.after]) if (side === undefined || !isJson(side) || JSON.stringify(side).length > DIRECTOR_RECEIPT_SIDE_MAX) fail("a tracker receipt's before and after must be JSON of a bounded size");
  }
}

const STATE_KEYS = ["chapters", "currentChapterId", "arcs", "seeds", "invisibleArcs", "notes", "pacing", "recentAnalysis", "nextIntentions", "suggestedActions", "lastDirective", "lastDirectiveTurn", "activity", "activityClearedAt", "nextId", "turn", "edits", "trackerUpdates"];
const COLLECTIONS = ["chapters", "arcs", "seeds", "invisibleArcs", "notes"] as const;

/** A snapshot the store may keep: plain JSON of the right shape, within its caps, with unique ids, at most DIRECTOR_STATE_BYTES_MAX serialized. Anything else is refused whole. */
export function checkDirectorState(value: unknown): DirectorState {
  if (!isPlainObject(value)) fail("the Director's state must be a plain object");
  for (const key of Object.keys(value)) if (!STATE_KEYS.includes(key)) fail(`the Director's state has an unknown field: ${key}`);
  for (const name of COLLECTIONS) {
    const list = value[name];
    if (!Array.isArray(list) || list.length > DIRECTOR_CAPS[name]) fail(`${name} must be a list of at most ${DIRECTOR_CAPS[name]}`);
    const ids = new Set<string>();
    for (const item of list) {
      if (!isPlainObject(item) || typeof item.id !== "string" || item.id.length === 0 || item.id.length > 80) fail(`every ${name} entry needs an id of 1 to 80 characters`);
      if (ids.has(item.id)) fail(`${name} has a duplicate id: ${item.id}`);
      ids.add(item.id);
    }
  }
  const { recentAnalysis, activity, nextIntentions, suggestedActions } = value;
  if (!Array.isArray(recentAnalysis) || recentAnalysis.length > DIRECTOR_ANALYSIS_MAX) fail(`recentAnalysis must be a list of at most ${DIRECTOR_ANALYSIS_MAX}`);
  if (!Array.isArray(activity) || activity.length > DIRECTOR_ACTIVITY_MAX) fail(`activity must be a list of at most ${DIRECTOR_ACTIVITY_MAX}`);
  if (!Array.isArray(nextIntentions) || nextIntentions.length > 50 || !Array.isArray(suggestedActions) || suggestedActions.length > 50) fail("nextIntentions and suggestedActions must be lists of at most 50");
  if (value.edits !== undefined && (!Array.isArray(value.edits) || value.edits.length > DIRECTOR_CAPS.edits || value.edits.some((e: unknown) => !isPlainObject(e) || typeof e.id !== "string" || !isPlainObject(e.edit)))) fail(`edits must be a list of at most ${DIRECTOR_CAPS.edits}`);
  if (value.trackerUpdates !== undefined) checkReceipts(value.trackerUpdates);
  if (value.turn !== undefined && !isWhole(value.turn, 0)) fail("turn must be a whole number");
  if (!isPlainObject(value.pacing)) fail("pacing must be a plain object");
  if (!isWhole(value.nextId, 0)) fail("nextId must be a whole number");
  if (!isJson(value)) fail("the Director's state must be JSON");
  if (JSON.stringify(value).length > DIRECTOR_STATE_BYTES_MAX) fail("the Director's state is too large");
  return value as unknown as DirectorState;
}
