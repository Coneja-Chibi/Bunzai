/**
 * The tracker macros in a prompt line follow the names they point at: renaming the tracker or one of its fields rewrites `{{tracker::Name}}`,
 * `{{tracker::Name::field}}` and `{{tracker::Name::row::field}}`. A rename is many keystrokes, so each keystroke is rewritten from the text as it was
 * when the rename began (an anchor), from the name it began with: a name passed through on the way (another tracker's, a sibling field's) never
 * takes macros that were not the renamed one's, and the macros the author wrote for it follow to the last name typed.
 */
import type { TrackerBody } from "../../../../entities/tracker/schema";

/** A tracker macro whose arguments hold no other macro: the part between `tracker::` and the closing braces. */
const MACRO = /(\{\{\s*tracker::)([^{}]*?)(\}\})/gi;

const same = (a: string | undefined, b: string): boolean => a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The text with every tracker macro's arguments passed through `change`, which returns the arguments to write (or the same ones). */
function mapMacros(text: string, change: (args: string[]) => string[]): string {
  return text.replace(MACRO, (_all, open: string, inner: string, close: string) => `${open}${change(inner.split("::")).join("::")}${close}`);
}

/** The text with macros that name tracker `from` naming `to`. */
export function renameTrackerIn(text: string, from: string, to: string): string {
  return mapMacros(text, (args) => (same(args[0], from) ? [to, ...args.slice(1)] : args));
}

/** The text with macros that read field `from` of the tracker called `tracker` reading `to`; a list's field is the third argument, a record's the second. */
export function renameFieldIn(text: string, tracker: Pick<TrackerBody, "name" | "layout">, from: string, to: string): string {
  const at = tracker.layout === "list" ? 2 : 1;
  return mapMacros(text, (args) => (same(args[0], tracker.name) && args[at]?.trim() === from ? args.map((a, i) => (i === at ? to : a)) : args));
}

/** What the prompt line was when a rename began, per kind of rename; null when none is going. */
export interface Anchors {
  field: { session: number; template: string | undefined } | null;
  /** `made` is the prompt line this rename last wrote: a prompt line that is anything else now was changed from elsewhere (a re-read, Take theirs, undo), and a new rename begins from it. */
  name: { name: string; template: string | undefined; made: string | undefined } | null;
}

export const noAnchors = (): Anchors => ({ field: null, name: null });

/** The body after one keystroke of a field rename: the prompt line rewritten from its text when that rename began. */
export function followFieldRename(body: TrackerBody, anchors: Anchors, rename: { from: string; to: string; session: number }): TrackerBody {
  if (anchors.field?.session !== rename.session) anchors.field = { session: rename.session, template: body.template };
  anchors.name = null;
  const start = anchors.field.template;
  return start === undefined ? body : { ...body, template: renameFieldIn(start, body, rename.from, rename.to) };
}

/** The body after one keystroke of the tracker's own rename. */
export function followNameRename(body: TrackerBody, anchors: Anchors, name: string): TrackerBody {
  if (!anchors.name || anchors.name.made !== body.template) anchors.name = { name: body.name, template: body.template, made: body.template };
  anchors.field = null;
  const start = anchors.name;
  const next = { ...body, name, ...(start.template === undefined ? {} : { template: renameTrackerIn(start.template, start.name, name) }) };
  start.made = next.template;
  return next;
}
