/**
 * A library tracker (entities/tracker) as the scene meets it, pure: the scene-state slot it lives in, its current value read from the
 * state (defaults filled, a value that does not fit its field read as the default), one update checked and cut into deltas, the single
 * `update_trackers` tool a model calls to change any linked tracker, and the text the prompt and macros show. What a field accepts is one
 * rule (entities/_shared/field-value.ts), the same the decoder holds a default to; a number whose top is another field (`maxField`) is judged
 * against that field's current value, settled first, wherever a value is read, defaulted or written. The slot families `tracker-record:*` and
 * `tracker-list:*` (scene-state/slots/) hold the state; the store only folds it, and every shape check is here, where the piece is known.
 * Nothing here cuts or caps text: a tracker's text is as long as its state, and the prompt budget measures it (assembly/assemble.ts).
 */
import type { TrackerBody, TrackerField } from "../entities/tracker/schema";
import { clampToField, fieldAccepts, fieldDefault, fieldIndex, settler, type FieldScalar } from "../entities/_shared/field-value";
import { SANITY_LIST } from "../entities/_shared/sanity";
import { deepEq, isRecord, recOr } from "./guards";
import type { TrackerView } from "./macros";
import type { Delta, SceneState } from "./scene-state/types";

export type Scalar = FieldScalar;
/** A record's fields, or one list row (which also holds its `name`). */
export type TrackerRecord = Record<string, Scalar>;
export type TrackerValue = TrackerRecord | TrackerRecord[];
/**
 * A tracker's value as the turn stands, in the two forms that must never be confused: `stored` is what the scene state holds (each field judged alone), and
 * `shown` is what is read from it (a number past a top taken from another field reads inside it). Writes are judged against `stored`; the prompt, the
 * macros, the tool line and the change read use `shown`. `shown` is always computed from `stored` by one function (`shownOf`).
 */
export interface TrackerState { shown: TrackerValue; stored: TrackerValue }
/** A tracker the turn linked: its piece id, its body, and its value as the turn stands, both forms. */
export interface LinkedTracker extends TrackerState { id: string; body: TrackerBody }

export const TRACKER_TOOL = "update_trackers";

/** The two slot families a tracker's state lives in, as the prefixes a slot id starts with. */
export const TRACKER_SLOT_PREFIXES = ["tracker-record:", "tracker-list:"] as const;

/** The slot a tracker keeps its state in: one family per layout, then the piece id. */
export const trackerSlot = (id: string, body: TrackerBody): string => `${TRACKER_SLOT_PREFIXES[body.layout === "record" ? 0 : 1]}${id}`;

/** The piece id a tracker slot belongs to, or null for any other slot (the inverse of `trackerSlot`). */
export const trackerOfSlot = (slot: string): string | null => {
  const prefix = TRACKER_SLOT_PREFIXES.find((p) => slot.startsWith(p));
  return prefix !== undefined && slot.length > prefix.length ? slot.slice(prefix.length) : null;
};

const own = (o: object, k: string): unknown => (Object.hasOwn(o, k) ? (o as Record<string, unknown>)[k] : undefined);

/** One stored value read through its field: the value when it fits; a number that is past a top taken from another field is brought inside it (its top moves in play); else the default. */
const read = (f: TrackerField, v: unknown): Scalar =>
  fieldAccepts(f, v) ? v : f.maxField !== undefined && typeof v === "number" && Number.isFinite(v) ? clampToField(f, v) : fieldDefault(f);

/** Every field of one record or row settled once, a top first; `make` judges a field against the rules it is handed. */
const settleAll = (body: TrackerBody, index: ReadonlyMap<string, TrackerField>, make: (rules: TrackerField) => Scalar): TrackerRecord => {
  const get = settler(index, make);
  return Object.fromEntries(body.fields.map((f) => [f.name, get(f.name)]));
};

/** The linked trackers as the macro reads them, by lowercased name; a name another tracker already has is left out, so a name means one tracker. */
export function trackerViews(linked: readonly LinkedTracker[] | undefined): Map<string, TrackerView> {
  const views = new Map<string, TrackerView>();
  for (const t of linked ?? []) if (!views.has(t.body.name.toLowerCase())) views.set(t.body.name.toLowerCase(), { body: t.body, value: t.shown, text: renderTracker(t.body, t.shown) });
  return views;
}

/**
 * Sets every view's text: first the default rendering of every value, then each template run against those, so a template that reads another
 * tracker sees its value (and its default text) whatever the order. `render` runs one template's macro text read-only on the turn's context.
 */
export function refreshTrackerTexts(views: ReadonlyMap<string, TrackerView>, render: (template: string) => string): void {
  for (const v of views.values()) v.text = renderTracker(v.body, v.value as TrackerValue);
  const made = [...views.values()].flatMap((v) => (v.body.template === undefined ? [] : [[v, render(v.body.template)] as const]));
  for (const [v, text] of made) v.text = text;
}

/** A record or row read from what is stored under it: a number past a top taken from another field (settled first) reads inside it. The one place `shown` is made. */
const shownOf = (body: TrackerBody, index: ReadonlyMap<string, TrackerField>, stored: TrackerRecord, dependent: boolean): TrackerRecord => {
  if (!dependent) return stored;
  const { name, ...fields } = stored;
  return { ...(name === undefined ? {} : { name }), ...settleAll(body, index, (f) => read(f, fields[f.name])) };
};

/** The tracker's value in the scene state, both forms: a record, or the list's rows (a row that cannot be read is left out). */
export function trackerState(state: SceneState, id: string, body: TrackerBody): TrackerState {
  const raw: unknown = state[trackerSlot(id, body)];
  const index = fieldIndex(body.fields);
  const dependent = body.fields.some((f) => f.maxField !== undefined);
  const alone = (get: (f: TrackerField) => unknown, name?: string): TrackerRecord => ({ ...(name === undefined ? {} : { name }), ...Object.fromEntries(body.fields.map((f) => [f.name, read(f, get(f))])) });
  if (body.layout === "record") {
    const cells = recOr(raw);
    const stored = alone((f) => { const cell = own(cells, f.name); return isRecord(cell) ? cell["value"] : undefined; });
    return { stored, shown: shownOf(body, index, stored, dependent) };
  }
  const rows = (Array.isArray(raw) ? raw : []).flatMap((r): TrackerRecord[] => (isRecord(r) && typeof r["name"] === "string" && r["name"].trim() !== "" ? [alone((f) => own(r, f.name), r["name"])] : []));
  return { stored: rows, shown: rows.map((r) => shownOf(body, index, r, dependent)) };
}

/** The tracker's current value as it is read (see `TrackerState`). */
export const trackerValue = (state: SceneState, id: string, body: TrackerBody): TrackerValue => trackerState(state, id, body).shown;

/**
 * A value on one line: a model-written row name or text cannot start a line, so it cannot forge a heading or another tracker. The one rule
 * for every place a value reaches a prompt (the default rendering and the tracker macro).
 */
export const lineOf = (v: Scalar): string => String(v).replace(/[\r\n\u2028\u2029\u0085\u000b\u000c]+/g, " ");
const pairs = (r: TrackerRecord, skip?: string): string => Object.entries(r).filter(([k]) => k !== skip).map(([k, v]) => `${k}=${lineOf(v)}`).join(", ");

/** The default text of a tracker: a record on one line, a list as its name and a line per row. Whole, never cut; values sit on one line each. */
export function renderTracker(body: TrackerBody, value: TrackerValue): string {
  if (!Array.isArray(value)) return `${body.name}: ${pairs(value)}`;
  return value.length === 0 ? `${body.name}: (none)` : `${body.name}:\n${value.map((r) => `- ${lineOf(r["name"]!)}: ${pairs(r, "name")}`).join("\n")}`;
}

/** One model-given field value read through its field: a number is held inside its range, an error in words for the model otherwise. */
function readField(f: TrackerField, v: unknown): { value: Scalar } | { error: string } {
  if (f.type === "number" && typeof v === "number" && Number.isFinite(v)) return { value: clampToField(f, v) };
  if (f.type !== "number" && fieldAccepts(f, v)) return { value: v };
  return { error: f.type === "choice" ? `${f.name} must be one of: ${f.choices!.join(", ")}.` : `${f.name} must be ${f.type === "boolean" ? "true or false" : f.type === "number" ? "a number" : "a text"}.` };
}

/** What a model's one update to one tracker asks for. */
export interface TrackerChange { row?: unknown; remove?: unknown; set?: unknown }

/**
 * A tracker's value while a call is applied to it: built once from the value the call starts from, then each item costs what its own fields cost.
 * A list keeps its rows (a removed one is left as a gap) and a map from each row's lower-cased name to its place, so finding a row is a lookup, not a scan.
 */
interface Work {
  id: string;
  body: TrackerBody;
  index: ReadonlyMap<string, TrackerField>;
  /** Whether any field takes its top from another, so a value read after a change must be settled again. */
  dependent: boolean;
  record?: TrackerRecord;
  rows?: (TrackerRecord | null)[];
  places?: Map<string, number>;
  live: number;
}

function workOf(id: string, body: TrackerBody, current: TrackerValue): Work { // `current` is what is stored
  const base = { id, body, index: fieldIndex(body.fields), dependent: body.fields.some((f) => f.maxField !== undefined) };
  if (!Array.isArray(current)) return { ...base, record: { ...current }, live: 0 };
  const rows: (TrackerRecord | null)[] = [...current];
  const places = new Map<string, number>();
  rows.forEach((r, i) => {
    const lower = String(r!["name"]).toLowerCase();
    if (!places.has(lower)) places.set(lower, i);
  });
  return { ...base, rows, places, live: rows.length };
}

/** The working value as the state it leaves: what is stored, and what is read from it. */
const stateOf = (w: Work): TrackerState => {
  const stored: TrackerValue = w.rows ? w.rows.filter((r): r is TrackerRecord => r !== null) : { ...w.record! };
  return { stored, shown: Array.isArray(stored) ? stored.map((r) => shownOf(w.body, w.index, r, w.dependent)) : shownOf(w.body, w.index, stored, w.dependent) };
};

/** Applies one item to the tracker's working value and returns its deltas; an error in words for the model, with the working value untouched. */
function applyItem(w: Work, args: TrackerChange, at: number): { deltas: Delta[] } | { error: string } {
  const { body } = w;
  const slot = trackerSlot(w.id, body);
  const list = w.rows !== undefined;
  if (!list && args.row !== undefined) return { error: "row is only for a list tracker." };
  if (!list && args.remove !== undefined) return { error: "remove is only for a list tracker." };
  if (args.remove !== undefined && typeof args.remove !== "boolean") return { error: "remove must be true or false." };
  if (args.remove === true && args.set !== undefined) return { error: "remove cannot come with set." };
  const given = typeof args.row === "string" ? args.row.trim() : "";
  if (list && given === "") return { error: args.row === undefined ? "row is required for a list tracker." : "row must be a text that is not blank." };
  // A row is found whatever the case of the name the model gives; the row keeps the name it was made with.
  const at0 = list ? w.places!.get(given.toLowerCase()) : undefined;
  const existing = at0 === undefined ? undefined : w.rows![at0]!;
  const name = existing ? String(existing["name"]) : given;
  if (args.remove === true) {
    if (at0 === undefined) return { error: `There is no row ${given} in ${body.name}.` };
    w.rows![at0] = null;
    w.places!.delete(given.toLowerCase());
    w.live -= 1;
    return { deltas: [{ slot, path: [name], removed: true, at }] };
  }
  if (args.set === undefined) return { error: "Give set with the fields to change." };
  if (!isRecord(args.set)) return { error: "set must be an object." };
  const unknown = Object.keys(args.set).filter((k) => !body.fields.some((f) => f.name === k));
  if (unknown.length > 0) return { error: `Unknown fields: ${unknown.join(", ")}.` };
  // A field not in `set` keeps what it holds (a new row, its defaults); one with a top from another field is judged against that field as the item leaves it, so `set` may name the top and the value in any order.
  const { set } = args;
  const held = existing ?? (list ? settleAll(body, w.index, fieldDefault) : w.record!);
  // What the model was shown: a stored value a moved top leaves over it reads inside the top, and it is that value a new top is applied to.
  const shown = w.dependent ? settleAll(body, w.index, (f) => read(f, held[f.name])) : held;
  let failure: string | undefined;
  const settled = settler(w.index, (f) => {
    if (!Object.hasOwn(set, f.name)) return read(f, shown[f.name]);
    const got = readField(f, set[f.name]);
    if ("error" in got) failure ??= got.error;
    return "error" in got ? fieldDefault(f) : got.value;
  });
  const made: TrackerRecord = {};
  for (const f of body.fields) if (Object.hasOwn(set, f.name)) made[f.name] = settled(f.name);
  if (failure !== undefined) return { error: failure };
  // What is stored equals what is read: when an item names a top, each dependent it did not name is written clamped (from what was shown, under the new top) wherever that differs from what is stored, in the same batch, after the fields the item named.
  const namesTop = w.dependent && body.fields.some((f) => f.maxField !== undefined && Object.hasOwn(set, f.maxField));
  if (namesTop) for (const f of body.fields) if (f.maxField !== undefined && !Object.hasOwn(set, f.name) && settled(f.name) !== held[f.name]) made[f.name] = settled(f.name);
  if (!list) {
    const before = w.record!;
    const changed = Object.keys(made).filter((k) => made[k] !== before[k]); // against what is stored, so a write of the stored value is no change
    Object.assign(before, made);
    return { deltas: changed.map((k): Delta => ({ slot, path: [k], value: made[k]!, at })) };
  }
  if (!existing && w.live >= SANITY_LIST) return { error: `${body.name} already has too many rows; remove one first.` };
  const row: TrackerRecord = { name, ...held, ...made };
  if (existing) w.rows![at0!] = row;
  else {
    w.rows!.push(row);
    w.places!.set(given.toLowerCase(), w.rows!.length - 1);
    w.live += 1;
  }
  return { deltas: existing && deepEq(existing, row) ? [] : [{ slot, path: [name], value: row, at }] };
}

/** One update checked against the tracker and cut into deltas (none for a value that does not change), with the value it leaves and its text; an error in words for the model otherwise. */
export function trackerUpdate(id: string, body: TrackerBody, current: TrackerState, args: TrackerChange, at: number): { deltas: Delta[]; state: TrackerState; value: TrackerValue; text: string } | { error: string } {
  const work = workOf(id, body, current.stored);
  const out = applyItem(work, args, at);
  if ("error" in out) return out;
  const state = stateOf(work);
  return { deltas: out.deltas, state, value: state.shown, text: renderTracker(body, state.shown) };
}

/** A field as the tool description names it: its name, its type with its range or choices, and what it means. */
function fieldWord(f: TrackerField): string {
  const range = f.maxField !== undefined ? (f.min !== undefined ? ` ${f.min} to ${f.maxField}` : ` up to ${f.maxField}`)
    : f.min !== undefined && f.max !== undefined ? ` ${f.min}-${f.max}` : f.min !== undefined ? ` ${f.min} or more` : f.max !== undefined ? ` up to ${f.max}` : "";
  const meaning = f.description.replace(/\s+/g, " ").trim();
  return `${f.name} (${f.type === "choice" ? f.choices!.join("|") : `${f.type}${range}`}${meaning ? `: ${meaning}` : ""})`;
}

/**
 * The one tool for every linked tracker: its description (a fixed sentence, then a line per tracker with every field, its type, range or choices and meaning,
 * and the tracker's note, none of it cut: a field the model is never told of is a field it cannot fill) and its function parameters.
 */
export function updateTrackersTool(bodies: readonly TrackerBody[]): { description: string; parameters: Record<string, unknown> } {
  const lines = bodies.map((b) => `${b.name} (${b.layout}): ${b.fields.map(fieldWord).join(", ")}.${b.note.trim() ? ` ${b.note.replace(/\s+/g, " ").trim()}` : ""}`);
  return {
    description: ["Update the story's trackers. One call may change several; every change is checked first and nothing is saved if any is refused.", ...lines].join("\n"),
    parameters: {
      type: "object",
      properties: {
        updates: {
          type: "array", minItems: 1, maxItems: SANITY_LIST,
          items: {
            type: "object",
            properties: { tracker: { type: "string", enum: bodies.map((b) => b.name) }, row: { type: "string" }, remove: { type: "boolean" }, set: { type: "object" } },
            required: ["tracker"], additionalProperties: false,
          },
        },
      },
      required: ["updates"], additionalProperties: false,
    },
  };
}

/** What the model's call looks like once its shape is checked: exactly what it sent, which the loop echoes back to it. */
export interface UpdatesCall { updates: unknown[] }

/** Why one item of a call has the wrong shape (not what it asks for: that is applyItem's), or null. `names` are the linked trackers' lower-cased names. */
function itemShape(item: unknown, names: ReadonlySet<string>, listed: () => string): string | null {
  if (!isRecord(item)) return "each update must be an object.";
  const unknown = Object.keys(item).filter((k) => k !== "tracker" && k !== "row" && k !== "remove" && k !== "set");
  if (unknown.length > 0) return `Unknown keys: ${unknown.join(", ")}.`;
  const wanted = item["tracker"];
  if (typeof wanted !== "string" || !names.has(wanted.trim().toLowerCase())) return `There is no tracker named ${typeof wanted === "string" ? wanted : "(none)"}. Trackers: ${listed()}.`;
  return null;
}

/**
 * The cheap check of a call before it runs: only its own shape (an object with a list of updates), in constant time. Every item, its tracker and what it asks
 * for are checked where the call is applied (applyTrackerUpdates), once, inside the tool's time budget, so the model is told every item's problem together.
 */
export function checkUpdatesShape(raw: unknown): string[] {
  const top = callProblem(raw);
  return top ? [top] : [];
}

/** Why the call as a whole has the wrong shape, or null. */
function callProblem(raw: unknown): string | null {
  if (!isRecord(raw) || Object.keys(raw).some((k) => k !== "updates")) return "Give an object with only updates.";
  const items = raw["updates"];
  return !Array.isArray(items) || items.length < 1 || items.length > SANITY_LIST ? "updates must be a list of one or more items." : null;
}

/** The call's shape problems: one for the call as a whole, or each item's by its place (found while it is applied). */
function shapeProblems(linked: readonly LinkedTracker[], raw: unknown): { top: string } | { items: Map<number, string> } {
  const top = callProblem(raw);
  if (top) return { top };
  const items = (raw as UpdatesCall).updates;
  const names = new Set(linked.map((t) => t.body.name.toLowerCase()));
  const listed = (): string => linked.map((t) => t.body.name).join(", ");
  const problems = new Map<number, string>();
  items.forEach((item, i) => {
    const why = itemShape(item, names, listed);
    if (why) problems.set(i, why);
  });
  return { items: problems };
}

/** What a call changed in one tracker, for the model: the record's fields that changed, or the rows set and removed, with the tracker's name. Its size follows the change, not the tracker. */
function changeText(body: TrackerBody, deltas: readonly Delta[]): string {
  if (deltas.length === 0) return `${body.name}: no change`;
  if (body.layout === "record") {
    const last = new Map<string, Scalar>();
    for (const d of deltas) last.set(d.path[0]!, d.value as Scalar);
    return `${body.name}: ${[...last].map(([k, v]) => `${k}=${lineOf(v)}`).join(", ")}`;
  }
  const last = new Map<string, TrackerRecord | null>();
  for (const d of deltas) last.set(d.path[0]!, d.removed ? null : (d.value as unknown as TrackerRecord));
  const set = [...last].flatMap(([name, row]) => (row ? [`${lineOf(name)} (${pairs(row, "name")})`] : []));
  const removed = [...last].flatMap(([name, row]) => (row ? [] : [lineOf(name)]));
  return `${body.name}: ${[set.join(", "), removed.length > 0 ? `removed ${removed.join(", ")}` : ""].filter(Boolean).join("; ")}`;
}

/**
 * The model's call applied in order to the linked trackers, each item on the value the ones before it left, all or nothing: any bad item
 * returns every item's error and no delta. Linear in the call: each tracker's value is set up once and each item costs its own fields. On success,
 * the deltas, each touched tracker's value after the call, and the text the model is answered with: only what the call changed, per tracker.
 */
export function applyTrackerUpdates(linked: readonly LinkedTracker[], raw: unknown, at: number): { deltas: Delta[]; values: Map<string, TrackerState>; text: string } | { errors: string[] } {
  const shape = shapeProblems(linked, raw);
  if ("top" in shape) return { errors: [shape.top] };
  const items = (raw as UpdatesCall).updates;
  const byName = new Map(linked.map((t) => [t.body.name.toLowerCase(), t]));
  const works = new Map<string, Work>();
  const changes = new Map<string, Delta[]>();
  const deltas: Delta[] = [];
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const broken = shape.items.get(i);
    if (broken) {
      errors.push(`Item ${i + 1}: ${broken}`);
      continue;
    }
    const item = items[i] as Record<string, unknown>;
    const target = byName.get((item["tracker"] as string).trim().toLowerCase())!;
    let work = works.get(target.id);
    if (!work) {
      works.set(target.id, (work = workOf(target.id, target.body, target.stored)));
      changes.set(target.id, []);
    }
    const out = applyItem(work, { row: item["row"], remove: item["remove"], set: item["set"] }, at);
    if ("error" in out) errors.push(`Item ${i + 1}: ${out.error}`);
    else {
      for (const d of out.deltas) (deltas.push(d), changes.get(target.id)!.push(d));
    }
  }
  if (errors.length > 0) return { errors };
  const values = new Map([...works].map(([id, w]) => [id, stateOf(w)]));
  return { deltas, values, text: [...works.values()].map((w) => changeText(w.body, changes.get(w.id)!)).join("\n") };
}
