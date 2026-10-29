/**
 * The saved chat summary as the `summary` slot holds it (slots/summary.ts), in two layers that never write the same path. Generated rows are keyed by the swipe id of the version
 * they end at and written on that version (a per-exchange line, or a block that removes the rows it replaces and adds its own), so a new version, a cut or a choice of version takes
 * the piece along. The person's own text is one row, `person`, written as an edit of the newest message; every save gives it a fresh `edit` id and the next number `n` along the chain of saves
 * (a number, not a list). Each generated row records the `edit` and `n` it saw when its writer read the take. The take's text is the person's text, then every generated row that is not covered: a row that saw an
 * older text (a smaller `n`, or none) was written before the person's save and is covered by it, however many there are. A row that saw this text, or one that saw a text with a larger `n` (a newer save whose
 * message has since been deleted), shows. A replacing block that shows stands in for the person's text.
 */
import type { JsonValue } from "../../stage/contracts/chat-store";
import type { TakeSummary } from "../../stage/contracts/chat-summary-types";
import type { Delta, SceneState } from "../scene-state/types";
import type { SummaryRow } from "./row-shape";

export type { SummaryRow };
/** The key of the person's row. */
export const PERSON = "person";

const allRows = (state: SceneState | null): SummaryRow[] => (Array.isArray(state?.["summary"]) ? (state!["summary"] as unknown as SummaryRow[]) : []);

/** The person's row, and the generated rows in the order the shown versions wrote them. */
export function layersOf(state: SceneState | null): { person: SummaryRow | undefined; rows: SummaryRow[] } {
  const rows = allRows(state);
  return { person: rows.find((r) => r.version === PERSON), rows: rows.filter((r) => r.version !== PERSON) };
}

/** The id of the person's current text, which a generated row records as what it saw; none when the person has not written. */
export const editOf = (state: SceneState | null): string | undefined => layersOf(state).person?.edit;

/** What a writer that reads this state records on its row: the id and number of the person's text it saw. Nothing when there is none. */
export function sawOf(state: SceneState | null): { saw?: string; sawN?: number } {
  const person = layersOf(state).person;
  return person?.edit === undefined ? {} : { saw: person.edit, sawN: person.n ?? 0 };
}

/** Whether the person's text at `person` covers a generated row: it saw an older text, or none. */
const covers = (person: SummaryRow, r: SummaryRow): boolean => r.saw !== person.edit && (r.sawN ?? 0) <= (person.n ?? 0);

/** What the take's summary is now, or null when nothing shows. */
export function takeOf(state: SceneState | null): TakeSummary | null {
  const { person, rows } = layersOf(state);
  const live = person ? rows.filter((r) => !covers(person, r)) : rows;
  const parts = person && person.text.trim() !== "" && !live.some((r) => r.replace) ? [person, ...live] : live;
  const last = parts.at(-1);
  return last ? { text: parts.map((r) => r.text).join("\n"), through: last.through, at: Math.max(...parts.map((r) => r.at)), ...(live.length > 0 ? { last: live.at(-1)!.version } : {}) } : null;
}

/** The deltas that write a generated `row`; a `replace` block also removes every other generated row (the person's is not touched). */
export function blockDeltas(state: SceneState | null, row: SummaryRow): Delta[] {
  const removals = row.replace ? layersOf(state).rows.filter((r) => r.version !== row.version).map((r): Delta => ({ slot: "summary", path: [r.version], removed: true, at: row.at })) : [];
  return [...removals, { slot: "summary", path: [row.version], value: { ...row } as unknown as JsonValue, at: row.at }];
}

/** The delta of the person's own text, a new save with a fresh `edit`; none when clearing a summary that shows nothing. One small row, however many generated rows there are. */
export function personDeltas(state: SceneState | null, input: { text: string; through: number } | null, at: number, edit: string): Delta[] {
  if (!input && takeOf(state) === null) return [];
  const row: SummaryRow = { version: PERSON, text: input?.text ?? "", through: input?.through ?? 0, at, edit, n: (layersOf(state).person?.n ?? 0) + 1 };
  return [{ slot: "summary", path: [PERSON], value: row as unknown as JsonValue, at }];
}
