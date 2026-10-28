/**
 * What the change visuals under a reply decide before they draw (approved wireframe premiere/scene-pieces.html, section 3, option D: each tracker chooses how its changes show), pure so each rule
 * is provable without a render. The read is the changes route's (studio/tracker-changes.ts): per tracker its own change style, icons and the bars its numbers are drawn between, and a line per
 * field or row that changed. Chips are one badge per line (a number with a top gets a small bar, and its delta is signed and goes up or down; a choice or text shows its new value; a list row shows
 * its name and the change in its count), a card is a row per line with the old value under the new one, a toast and its marker carry the sentence of Reply N's changes, and hidden draws nothing.
 */
import { isRecord } from "../../../../../core/guards";
import type { JsonValue } from "../../../../../stage/contracts/chat-store";
import type { TrackerChanged, TrackerChangeLine } from "../../../../../studio/tracker-changes";
import { changeSentence, fillBetween, finite } from "../panels/trackers/library-core";


/** A value as a person reads it. */
export const shown = (v: JsonValue | undefined): string => (v === null || v === undefined ? "none" : typeof v === "object" ? JSON.stringify(v) : String(v));
/** The digits after the point a stored number carries ("0.25" has two): the precision its field was written at. */
const decimalsOf = (n: number): number => {
  const [mantissa = "", exponent] = String(n).split("e");
  return Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exponent ?? 0));
};

/** "+3" or "-3": a change of a number, shown at the precision of the two values themselves (the more precise of them), so a whole number never grows decimals; the direction is what the color follows. */
export function deltaOf(before: number, after: number): { text: string; dir: "up" | "down" } | null {
  const d = Number((after - before).toFixed(Math.min(100, Math.max(decimalsOf(before), decimalsOf(after)))));
  return d === 0 ? null : { text: d > 0 ? `+${d}` : `${d}`, dir: d > 0 ? "up" : "down" };
}

/** The change in a list row's count: its first number field, before to after (a row added or removed counts from or to nothing). */
function rowDelta(line: TrackerChangeLine): { text: string; dir: "up" | "down" } | null {
  const was = isRecord(line.before) ? line.before : {};
  const now = isRecord(line.after) ? line.after : {};
  const key = Object.keys({ ...now, ...was }).find((k) => finite(now[k]) || finite(was[k]));
  if (key === undefined) return null;
  return deltaOf(finite(was[key]) ? was[key] : 0, finite(now[key]) ? now[key] : 0);
}

export interface ChipView {
  key: string;
  icon: string | undefined;
  label: string;
  /** "7/20" for a number with a top, the number for one without. */
  value?: string;
  /** How full the small bar is, 0 to 1; only a number with a top has one. */
  fill?: number;
  delta?: { text: string; dir: "up" | "down" };
}

/** One badge per changed line of a tracker. */
export function chipsOf(t: TrackerChanged): ChipView[] {
  return t.changes.map((line, i): ChipView => {
    const key = `${t.trackerId}.${line.field ?? line.row ?? i}`;
    if (line.row !== undefined) {
      const delta = rowDelta(line);
      return { key, icon: t.icon, label: `${line.added ? "+ " : line.removed ? "- " : ""}${line.row}`, ...(delta ? { delta } : {}) };
    }
    const field = line.field ?? "";
    const icon = t.fieldIcons?.[field];
    if (finite(line.after)) {
      const bar = t.bars?.[field];
      const delta = finite(line.before) ? deltaOf(line.before, line.after) : null;
      return { key, icon, label: field, value: bar ? `${line.after}/${bar.top}` : String(line.after), ...(bar ? { fill: fillBetween(bar.min, bar.top, line.after) } : {}), ...(delta ? { delta } : {}) };
    }
    return { key, icon, label: typeof line.after === "boolean" ? (line.after ? field : `not ${field}`) : shown(line.after) };
  });
}

export interface CardRow {
  key: string;
  icon: string | undefined;
  label: string;
  /** The new value, or what happened to a row. */
  now: string;
  /** The old value, when there was one. */
  was?: string;
  /** A bar with where the old value stood, for a number with a top. */
  bar?: { fill: number; was: number };
}

/** One row per changed line of a tracker: the new value, with the old one under it. */
export function cardRows(t: TrackerChanged): CardRow[] {
  return t.changes.map((line, i): CardRow => {
    const key = `${t.trackerId}.${line.field ?? line.row ?? i}`;
    if (line.row !== undefined) return { key, icon: t.icon, label: line.row, now: line.added ? "added" : line.removed ? "removed" : "changed" };
    const field = line.field ?? "";
    const bar = t.bars?.[field];
    const base = { key, icon: t.fieldIcons?.[field], label: field, was: shown(line.before) };
    if (finite(line.after) && bar) return { ...base, now: `${line.after}/${bar.top}`, bar: { fill: fillBetween(bar.min, bar.top, line.after), was: finite(line.before) ? fillBetween(bar.min, bar.top, line.before) : 0 } };
    return { ...base, now: shown(line.after) };
  });
}

/** Every tracker of one reply that changed something, sorted by how it chose to show it; a hidden tracker is left out. */
export function splitByStyle(trackers: readonly TrackerChanged[]): { chips: TrackerChanged[]; cards: TrackerChanged[]; toasts: TrackerChanged[] } {
  const live = trackers.filter((t) => t.changes.length > 0);
  return { chips: live.filter((t) => t.style === "chips"), cards: live.filter((t) => t.style === "card"), toasts: live.filter((t) => t.style === "toast") };
}

/** How many changes the toast trackers made, for the marker: "2 changes". */
export const markerText = (toasts: readonly TrackerChanged[]): string => {
  const n = toasts.reduce((sum, t) => sum + t.changes.length, 0);
  return `${n} ${n === 1 ? "change" : "changes"}`;
};

/** The toast's sentence: "Reply 42 changed hp 10 → 7 and mood calm → hurt."; null when the toast trackers changed nothing. */
export const toastWords = (reply: number, toasts: readonly TrackerChanged[]): string | null => changeSentence(reply, toasts.flatMap((t) => t.changes));

/** The macros that ran out of time, as the reply's line says it: "1 macro ran out of time building this prompt ({{tally}} in the card)". Only the name is known, so no place is named. */
export function outOfTimeWords(macros: readonly { macro: string }[]): string {
  const names = macros.map((m) => m.macro).filter((m) => m !== "").map((m) => `{{${m}}}`);
  return `${macros.length} ${macros.length === 1 ? "macro ran" : "macros ran"} out of time building this prompt${names.length > 0 ? ` (${names.join(", ")})` : ""}.`;
}
