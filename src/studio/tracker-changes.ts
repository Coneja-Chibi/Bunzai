/**
 * What a reply changed in the library trackers, for the Messenger: for a range of a take's live messages, each message's net change to every tracker slot
 * on its shown version (and the person's own edits on it), with the tracker's name, its change style and its icons so the page does not fetch pieces.
 * One forward pass: the store's range read (ChatStore.sceneDeltas) gives the state before the first message and each message's deltas in fold order,
 * and the state is folded forward through them. Read only. Only tracker slots count; a tracker whose piece cannot be read is reported by its id with the
 * values as stored, and a piece whose layout changed since is read the same way, since its slot is not the one its fields describe.
 */
import { deepEq, isRecord, recOr } from "../core/guards";
import { fold } from "../core/scene-state/fold";
import type { SceneState } from "../core/scene-state/types";
import { TRACKER_SLOT_PREFIXES, trackerOfSlot, trackerSlot, trackerValue, type TrackerRecord } from "../core/tracker";
import { DEFAULT_CHANGE_STYLE, type TrackerBody, type TrackerChangeStyle } from "../entities/tracker/schema";
import { slotOf } from "../generated/slots";
import type { ChatStore, JsonValue } from "../stage/contracts/chat-store";
import type { ReadTracker } from "./library-trackers";

/** One field of a record, or one row of a list, that a message changed. `before` or `after` is null when the field or row was not there (`added`) or is gone (`removed`). */
export interface TrackerChangeLine { field?: string; row?: string; before: JsonValue; after: JsonValue; added?: true; removed?: true }

export interface TrackerChanged {
  trackerId: string;
  /** The piece's name, or its id when the piece cannot be read. */
  name: string;
  style: TrackerChangeStyle;
  icon?: string;
  /** The icon of each field that has one. */
  fieldIcons?: Record<string, string>;
  /** For each changed number field that has a top (its own `max`, or the value of the field its `maxField` names, as the message left it): the bottom and the top its bar is drawn between. */
  bars?: Record<string, { min: number; top: number }>;
  changes: TrackerChangeLine[];
}

/** The trackers one message changed; a message that changed none is not listed. */
export interface MessageTrackerChanges { messageId: string; trackers: TrackerChanged[] }

/** A record's cells by field name, or a list's rows by row name (without the name): the stored values, or the values a read gives when the piece is known. */
function cellsOf(state: SceneState, slot: string, id: string, body: TrackerBody | null): Map<string, JsonValue> {
  if (body) {
    const value = trackerValue(state, id, body);
    return new Map(Array.isArray(value) ? value.map((r): [string, JsonValue] => [String(r["name"]), withoutName(r)]) : Object.entries(value));
  }
  const stored = state[slot];
  if (Array.isArray(stored)) return new Map(stored.flatMap((r): [string, JsonValue][] => (isRecord(r) && typeof r["name"] === "string" ? [[r["name"], withoutName(r as TrackerRecord)]] : [])));
  return new Map(Object.entries(recOr(stored)).flatMap(([k, c]): [string, JsonValue][] => (isRecord(c) && c["value"] !== undefined ? [[k, c["value"] as JsonValue]] : [])));
}

const withoutName = (row: TrackerRecord): JsonValue => {
  const { name: _name, ...rest } = row;
  return rest;
};

/** What differs between two reads of one slot: a line per field or row, in the later read's order, then the ones that are gone. */
function linesOf(kind: "field" | "row", before: ReadonlyMap<string, JsonValue>, after: ReadonlyMap<string, JsonValue>): TrackerChangeLine[] {
  const key = (name: string) => (kind === "field" ? { field: name } : { row: name });
  const lines: TrackerChangeLine[] = [];
  for (const [name, value] of after) {
    if (!before.has(name)) lines.push({ ...key(name), before: null, after: value, added: true });
    else if (!deepEq(before.get(name), value)) lines.push({ ...key(name), before: before.get(name)!, after: value });
  }
  for (const [name, value] of before) if (!after.has(name)) lines.push({ ...key(name), before: value, after: null, removed: true });
  return lines;
}

/**
 * The tracker changes of each live message from `from` through `to` (the tip when omitted) on a take, oldest first. Null when the take or either message is
 * not there (absent, deleted or cut). `read` reads a tracker piece by id (a gone or unreadable one is null); each piece is read once.
 */
export async function trackerChangesBetween(chats: Pick<ChatStore, "sceneDeltas">, read: ReadTracker | undefined, branchId: string, from: string, to?: string): Promise<MessageTrackerChanges[] | null> {
  const range = await chats.sceneDeltas(branchId, from, to, TRACKER_SLOT_PREFIXES);
  if (!range) return null;
  const bodies = new Map<string, Promise<TrackerBody | null>>();
  const bodyOf = (id: string): Promise<TrackerBody | null> => bodies.get(id) ?? bodies.set(id, read ? read(id) : Promise.resolve(null)).get(id)!;
  let state = range.before;
  /** Each touched slot as the last message left it: the next message that touches it starts from this, not from a second read of the state. */
  const left = new Map<string, Map<string, JsonValue>>();
  const out: MessageTrackerChanges[] = [];
  for (const message of range.messages) {
    const mine = message.deltas.filter((d) => trackerOfSlot(d.slot) !== null);
    if (mine.length === 0) continue;
    const next = fold(state, mine, slotOf);
    const trackers: TrackerChanged[] = [];
    for (const slot of new Set(mine.map((d) => d.slot))) {
      const id = trackerOfSlot(slot)!;
      const body = await bodyOf(id);
      const known = body && trackerSlot(id, body) === slot ? body : null;
      const after = cellsOf(next, slot, id, known);
      const changes = linesOf(slot.startsWith("tracker-list:") ? "row" : "field", left.get(slot) ?? cellsOf(state, slot, id, known), after);
      left.set(slot, after);
      if (changes.length === 0) continue;
      const icons = (body?.fields ?? []).flatMap((f): [string, string][] => (f.icon ? [[f.name, f.icon]] : []));
      const bars = Object.fromEntries((known?.fields ?? []).flatMap((f): [string, { min: number; top: number }][] => {
        const top = f.maxField !== undefined ? after.get(f.maxField) : f.max;
        return f.type === "number" && typeof top === "number" && Number.isFinite(top) && changes.some((c) => c.field === f.name) ? [[f.name, { min: f.min ?? 0, top }]] : [];
      }));
      trackers.push({
        trackerId: id, name: body?.name ?? id, style: body?.changes ?? DEFAULT_CHANGE_STYLE,
        ...(body?.icon ? { icon: body.icon } : {}), ...(icons.length > 0 ? { fieldIcons: Object.fromEntries(icons) } : {}), ...(Object.keys(bars).length > 0 ? { bars } : {}), changes,
      });
    }
    state = next;
    if (trackers.length > 0) out.push({ messageId: message.messageId, trackers });
  }
  return out;
}
