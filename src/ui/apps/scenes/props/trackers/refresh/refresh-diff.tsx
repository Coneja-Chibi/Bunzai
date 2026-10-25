/**
 * What a refresh proposal changes, as the review sheets draw it: Added, Changed and Removed rows (the +, ~ and - markers in the ok, warn and danger tokens), then the line for
 * entries the model's answer lost ("1 item skipped: its species is not in the answer"). Presentational: core/trackers/refresh.ts made the diff.
 */
import type { JSX } from "react";
import { isRecord } from "../../../../../../core/guards";
import type { Change, ModuleDiff, Skipped } from "../../../../../../core/trackers/refresh";

const LONG = 60;
const show = (v: unknown): string => {
  const text = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v) ?? "";
  return text.length > LONG ? `${text.slice(0, LONG - 3)}...` : text;
};

/** The fields that differ between two values, or the two values themselves when they are not records. */
export function fieldChanges(before: unknown, after: unknown): { key: string; was: string; now: string }[] {
  if (!isRecord(before) || !isRecord(after)) return [{ key: "", was: show(before), now: show(after) }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .slice(0, 4)
    .map((key) => ({ key, was: show(before[key]), now: show(after[key]) }));
}

/** A line about a new entry: its first few plain fields, which is what the person recognises it by. */
export function gist(value: unknown): string {
  if (!isRecord(value)) return value === undefined ? "" : show(value);
  return Object.entries(value).filter(([, v]) => typeof v === "string" || typeof v === "number").slice(1, 3).map(([, v]) => show(v)).filter(Boolean).join(" / ");
}

export const countOf = (d: ModuleDiff): number => d.added.length + d.changed.length + d.removed.length;
export const skippedLine = (skipped: readonly Skipped[]): string =>
  `${skipped.length} ${skipped.length === 1 ? "item" : "items"} skipped: ${skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}`;

function Section({ kind, title, mark, rows, detail, note }: { kind: "added" | "changed" | "removed"; title: string; mark: string; rows: readonly Change[]; detail(c: Change): JSX.Element | string | null; note?: string }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <div className={`rv-sec ${kind}`} data-part={`props.tracker.review.${kind}`}>
      <div className="rv-sh">{title}<span>{rows.length}{note ? ` · ${note}` : ""}</span></div>
      {rows.map((c, i) => (
        <div key={`${c.list}-${c.label}-${i}`} className="rv-row"><span className="rv-mk">{mark}</span><div><b>{c.label}</b>{detail(c) && <div className="rv-dt">{detail(c)}</div>}</div></div>
      ))}
    </div>
  );
}

export function DiffSections({ diff, skipped }: { diff: ModuleDiff; skipped: readonly Skipped[] }): JSX.Element {
  return (
    <>
      <Section kind="added" title="Added" mark="+" rows={diff.added} detail={(c) => gist(c.after) || null} />
      <Section kind="changed" title="Changed" mark="~" rows={diff.changed}
        detail={(c) => <>{fieldChanges(c.before, c.after).map((f) => <span key={f.key} className="rv-ch">{f.key && <i>{f.key}: </i>}<s>{f.was}</s> {"→"} <em>{f.now}</em></span>)}</>} />
      <Section kind="removed" title="Removed" mark="-" rows={diff.removed} detail={() => null} note="hidden, not erased" />
      {skipped.length > 0 && <p className="rv-skip" role="status" data-part="props.tracker.review.skipped">{skippedLine(skipped)}</p>}
    </>
  );
}
