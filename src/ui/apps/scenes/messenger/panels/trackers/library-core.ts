/**
 * What the Trackers panel decides before it draws a library tracker (approved wireframe premiere/scene-pieces.html, callout 1), pure so each rule is provable without a render: how a field
 * shows (a number with a top is a bar, an open number is the number, a choice is pips, yes or no is one pip, text is the text), which fields a card leaves out because a bar already draws them,
 * a list's item tiles with a count, the sentence "Reply N changed ...", the shape line of a library piece, and the link list after a check. Values arrive already read by the server
 * (studio/scene-trackers.ts): a number past its top has been brought inside it, so a bar never overflows.
 */
import type { TrackerRecord } from "../../../../../../core/tracker";
import type { TrackerBody, TrackerField } from "../../../../../../entities/tracker/schema";
import type { TrackerChangeLine } from "../../../../../../studio/tracker-changes";
import { isRecord } from "../../../../../../core/guards";

/** How one field draws: its name and icon, and one of five faces. */
export type FieldView = { name: string; icon?: string } & (
  | { kind: "bar"; value: number; top: number; fill: number }
  | { kind: "number"; value: number }
  | { kind: "pips"; choices: readonly string[]; current: string }
  | { kind: "flag"; on: boolean }
  | { kind: "text"; text: string }
);

export const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The top a number field draws against: the current value of the field it names, else its own `max`; none when it has neither (or the named field holds no number). */
export function topOf(f: TrackerField, record: TrackerRecord): number | undefined {
  const top = f.maxField !== undefined ? record[f.maxField] : f.max;
  return finite(top) ? top : undefined;
}

/** Where a value stands between a bar's bottom and top, 0 to 1 (an empty range is empty). The one fill rule: the panel's cards and the change visuals under a reply both draw by it. */
export const fillBetween = (bottom: number, top: number, value: number): number => (top > bottom ? Math.min(1, Math.max(0, (value - bottom) / (top - bottom))) : 0);

/** A bar's fill, 0 to 1: where the value stands between the field's bottom (its `min`, else 0) and its top. */
export const fillOf = (f: TrackerField, value: number, top: number): number => fillBetween(f.min ?? 0, top, value);

/** Whether a bar can be dragged: it moves in whole steps, so its bottom, its top and its value must be whole. Any other bar is set by typing the number, which takes any value. */
export const draggable = (bottom: number, top: number, value: number): boolean => Number.isInteger(bottom) && Number.isInteger(top) && Number.isInteger(value);

/** One field of a record or row as it draws. */
export function fieldView(f: TrackerField, record: TrackerRecord): FieldView {
  const base = { name: f.name, ...(f.icon !== undefined ? { icon: f.icon } : {}) };
  const v = record[f.name];
  if (f.type === "boolean") return { ...base, kind: "flag", on: v === true };
  if (f.type === "choice") return { ...base, kind: "pips", choices: f.choices ?? [], current: String(v) };
  if (f.type === "text") return { ...base, kind: "text", text: String(v ?? "") };
  const value = finite(v) ? v : 0;
  const top = topOf(f, record);
  return top === undefined ? { ...base, kind: "number", value } : { ...base, kind: "bar", value, top, fill: fillOf(f, value, top) };
}

/** The fields a card draws: every field except a number that is another field's top, which that field's bar already shows ("7/20"). The editor draws them all. */
export function cardFields(body: TrackerBody, record: TrackerRecord): TrackerField[] {
  const tops = new Set(body.fields.flatMap((f) => (f.maxField !== undefined && topOf(f, record) !== undefined ? [f.maxField] : [])));
  return body.fields.filter((f) => !tops.has(f.name));
}

/** One item tile of a list: the row's name, the tracker's icon, and its count (the row's first number field) when it has one. */
export interface ItemTile { name: string; icon?: string; count?: number }

export function itemTiles(body: TrackerBody, rows: readonly TrackerRecord[]): ItemTile[] {
  const counted = body.fields.find((f) => f.type === "number");
  return rows.map((r) => {
    const count = counted ? r[counted.name] : undefined;
    return { name: String(r["name"]), ...(body.icon !== undefined ? { icon: body.icon } : {}), ...(finite(count) ? { count } : {}) };
  });
}

const show = (v: unknown): string => (v === null || v === undefined ? "none" : String(v));

/** One change line in words: a field `hp 10 to 7`, a row added, removed or changed. */
function lineWords(line: TrackerChangeLine): string {
  if (line.field !== undefined) return `${line.field} ${show(line.before)} → ${show(line.after)}`;
  const row = line.row ?? "";
  return line.added ? `added ${row}` : line.removed ? `removed ${row}` : `${row} changed`;
}

/** "Reply 42 changed hp 10 → 7 and mood calm → hurt." (the reply is `number`, as the Messenger counts messages); none when the reply changed nothing the read lists. */
export function changeSentence(number: number, lines: readonly TrackerChangeLine[]): string | null {
  const words = lines.map(lineWords);
  if (words.length === 0) return null;
  const list = words.length === 1 ? words[0]! : `${words.slice(0, -1).join(", ")} and ${words.at(-1)!}`;
  return `Reply ${number} changed ${list}.`;
}

/** What a library piece is, as text: "record, 3 fields". It describes the piece; it is not a limit. */
export const shapeText = (layout: string, fields: number): string => `${layout}, ${fields} ${fields === 1 ? "field" : "fields"}`;

/** The shape line of a stored tracker as the library returns it, or null when it does not read as one. */
export function shapeOf(entity: unknown): string | null {
  const body = isRecord(entity) ? entity["body"] : null;
  return isRecord(body) && typeof body["layout"] === "string" && Array.isArray(body["fields"]) ? shapeText(body["layout"], body["fields"].length) : null;
}

/** The link list after one check: the id added at the end, or taken out; no duplicates. */
export const toggleLinked = (linked: readonly string[], id: string, on: boolean): string[] => (on ? (linked.includes(id) ? [...linked] : [...linked, id]) : linked.filter((x) => x !== id));
