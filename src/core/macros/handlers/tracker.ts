/**
 * Bunraku's read-only `tracker` macro: a linked library tracker's state in any macro text (entities/tracker, core/tracker.ts).
 * `{{tracker::Name}}` is its rendered text, `{{tracker::Name::field}}` a record's field, `{{tracker::Name::row::field}}` a list row's
 * field. The turn hands it the linked trackers on the context (`trackers`, by lowercased name); it reads them and changes nothing. An
 * unknown tracker, row or field is a macro error that names it.
 */
import { lineOf, type Scalar, type TrackerRecord } from "../../tracker";
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult, TrackerView } from "../types";

const fail = (error: string): MacroResult => ({ value: "", success: false, error });
const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const trackerMacro: MacroDefinition = {
  name: "tracker",
  description: "A linked tracker's state: its text, a record's field, or a list row's field",
  args: [
    { name: "name", description: "The tracker's name", required: true },
    { name: "field", description: "A record's field, or a list's row name", required: false },
    { name: "rowField", description: "A list row's field", required: false },
  ],
  category: "variables",
  hasSideEffects: false,
  handler: (args: string[], context: MacroContext, _run: HandlerRun): MacroResult => {
    const wanted = (args[0] ?? "").trim();
    if (!wanted) return fail("Give a tracker name");
    const all: ReadonlyMap<string, TrackerView> = context.trackers ?? new Map();
    const found = all.get(wanted.toLowerCase());
    if (!found) return fail(`There is no tracker named ${wanted}. ${all.size === 0 ? "No tracker is linked to this scene." : `Trackers: ${[...all.values()].map((t) => t.body.name).join(", ")}.`}`);
    const { body, value } = found;
    if (args.length < 2) return { value: found.text, success: true };
    const fields = body.fields.map((f) => f.name);
    const field = (name: string) => (fields.includes(name) ? null : fail(`${body.name} has no field ${name}. Fields: ${fields.join(", ")}.`));
    if (body.layout === "record") {
      if (args.length > 2) return fail(`${body.name} is a record: use {{tracker::${body.name}::field}}.`);
      const bad = field(args[1]!);
      return bad ?? { value: lineOf((value as TrackerRecord)[args[1]!]!), success: true };
    }
    if (args.length < 3) return fail(`${body.name} is a list: use {{tracker::${body.name}::row::field}}.`);
    const row = (value as Record<string, unknown>[]).find((r) => same(String(r["name"]), args[1]!));
    if (!row) return fail(`${body.name} has no row ${args[1]!.trim()}.`);
    return field(args[2]!) ?? { value: lineOf(row[args[2]!] as Scalar), success: true };
  },
};

export const TRACKER_MACROS: MacroDefinition[] = [trackerMacro];
