/**
 * Canonical tracker piece: named, typed fields a scene keeps as swipe-safe state (core/tracker.ts), shows the model every turn, lets
 * macros read anywhere, and lets the model update through one tool. It is data, never code. A scene links the trackers it keeps
 * (ChatPrompting.trackers); the same piece can be linked anywhere. Not the Props trackers (core/trackers/), which are first-party modules.
 */
import type { CanonicalEntity } from "../../core/canonical";

export type TrackerFieldType = "text" | "number" | "boolean" | "choice";

/** One value a tracker keeps. The first four are the field basics a tool's argument shares (entities/_shared/field-schema.ts). */
export interface TrackerField {
  /** A lowercase letter, then lowercase letters, digits and _. */
  name: string;
  description: string;
  type: TrackerFieldType;
  /** The allowed values of a choice field; only a choice field has them. */
  choices?: string[];
  /** Number only; at most `max`. */
  min?: number;
  max?: number;
  /** Must fit the type, the choices and the range. */
  default?: string | number | boolean;
}

export type TrackerLayout = "record" | "list";

export interface TrackerBody {
  name: string;
  description: string;
  /** record: one set of fields; list: rows, each keyed by a text `name` and holding every field. */
  layout: TrackerLayout;
  fields: TrackerField[];
  /** How the model should update it; goes into the update tool's description. */
  note: string;
  /** Macro text for the tracker's prompt line; absent means the default rendering. */
  template?: string;
}

export type CanonicalTracker = CanonicalEntity<"tracker", TrackerBody>;

/** A blank tracker: one record with one number field, `value`, starting at 0. */
export const emptyTrackerBody = (name: string): TrackerBody => ({
  name, description: "", layout: "record", note: "",
  fields: [{ name: "value", description: "", type: "number", default: 0 }],
});
