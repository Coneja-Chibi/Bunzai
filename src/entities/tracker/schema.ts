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
  /** Number only, and not with `max`: the name of another number field of this tracker whose current value is this field's top (hp out of hp_max). A value above it is brought down to it, never refused. */
  maxField?: string;
  /** A well-formed icon id (`lucide:name` or `mdi:name`); absent means no icon. Not checked against the glyph table: the UI draws only ids it knows. */
  icon?: string;
  /** Must fit the type, the choices and the range. */
  default?: string | number | boolean;
}

export type TrackerLayout = "record" | "list";

/** How a reply's changes to a tracker are drawn under it: small chips, a card, a toast, or not at all. */
export type TrackerChangeStyle = "chips" | "card" | "toast" | "hidden";
/** The style a tracker has when it names none. */
export const DEFAULT_CHANGE_STYLE: TrackerChangeStyle = "chips";

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
  /** An icon id for the tracker itself, or for each row of a list; absent means no icon. */
  icon?: string;
  /** How a reply's changes to this tracker are drawn; absent means chips. Stored only: the Messenger reads it. */
  changes?: TrackerChangeStyle;
}

export type CanonicalTracker = CanonicalEntity<"tracker", TrackerBody>;

/** A blank tracker: one record with one number field, `value`, starting at 0. */
export const emptyTrackerBody = (name: string): TrackerBody => ({
  name, description: "", layout: "record", note: "",
  fields: [{ name: "value", description: "", type: "number", default: 0 }],
});
