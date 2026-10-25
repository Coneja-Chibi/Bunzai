/**
 * Draws an entry's typed fields from the layout table (RoleCall `details/_shared.tsx`: `FieldBlock`, `StringChipList`,
 * `KeyValueList`): raised blocks with a star-marked label, three-up tiles, chips for lists of words, rows for lists of objects,
 * labelled lines for an object. One value drawer handles whatever shape the book holds, since imported and model-written data
 * is not always the shape its schema declares. Nothing here edits.
 */
import type { JSX, ReactNode } from "react";
import { isRecord, type Rec } from "../../../../../core/guards";
import { parseStructured, type EntryType } from "../../../../../core/compendium";
import { BLANK, GLYPH, titled } from "../compendium-core";
import { HEADER_FIELDS, LAYOUTS, type Block } from "./layouts";

const pluck = (data: Rec, path: string): unknown => path.split(".").reduce<unknown>((cur, k) => (isRecord(cur) ? cur[k] : undefined), data);
const prim = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "Yes" : "No") : "");
export const isEmpty = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0) || (isRecord(v) && Object.values(v).every(isEmpty));

/** An object or list flattened to one line of text, for the places a row has room for only that. */
function plain(v: unknown): string {
  if (Array.isArray(v)) return v.map(plain).filter(Boolean).join("; ");
  if (isRecord(v)) return Object.entries(v).filter(([, x]) => !isEmpty(x)).map(([k, x]) => `${titled(k)}: ${plain(x)}`).join(", ");
  return prim(v);
}

const PRIMARY = ["with", "name", "org", "title", "what_happened", "topic", "phase", "label", "who"];
const RIGHT = ["nature", "role", "status"];

/** A row for one object in a list: its main word, the rest as a quiet line, and its nature or role on the right. */
function ObjectRow({ o }: { o: Rec }): JSX.Element {
  const primary = PRIMARY.find((k) => prim(o[k]) !== "") ?? Object.keys(o).find((k) => prim(o[k]) !== "");
  const right = RIGHT.find((k) => k !== primary && prim(o[k]) !== "");
  const rest = Object.entries(o).filter(([k, x]) => k !== primary && k !== right && !isEmpty(x) && typeof x !== "boolean").map(([, x]) => plain(x)).join(` ${GLYPH.dot} `);
  return <div className="cp-or"><div><div className="m">{primary ? prim(o[primary]) : BLANK}</div>{rest && <div className="q">{rest}</div>}</div>{right && <span className="r">{prim(o[right])}</span>}</div>;
}

export function Value({ v }: { v: unknown }): JSX.Element | null {
  if (isEmpty(v)) return null;
  if (Array.isArray(v)) {
    return v.every((x) => typeof x !== "object" || x === null)
      ? <div className="cp-chips">{v.map((x, i) => <span key={i}>{prim(x)}</span>)}</div>
      : <div className="cp-ors">{v.map((x, i) => (isRecord(x) ? <ObjectRow key={i} o={x} /> : <div key={i} className="cp-or"><div className="m">{plain(x)}</div></div>))}</div>;
  }
  if (isRecord(v)) return <div className="cp-kv">{Object.entries(v).filter(([, x]) => !isEmpty(x)).map(([k, x]) => <div key={k}><span className="k">{titled(k)}</span><div className="x">{typeof x === "object" ? <Value v={x} /> : prim(x)}</div></div>)}</div>;
  return <div className="cp-txt">{prim(v)}</div>;
}

export function FieldBlock({ label, children, tile }: { label: string; children: ReactNode; tile?: boolean }): JSX.Element {
  return <div className={`cp-fb${tile ? " tile" : ""}`}><div className="fl"><span>{GLYPH.star}</span>{label}</div>{children}</div>;
}

function Arc({ data }: { data: Rec }): JSX.Element | null {
  const arc = isRecord(data["arc"]) ? data["arc"] : {};
  const moments = Array.isArray(arc["key_moments"]) ? (arc["key_moments"] as unknown[]).map(prim).filter(Boolean) : [];
  if (moments.length === 0) return null;
  const at = typeof arc["current_phase_index"] === "number" ? Math.min(Math.max(Math.trunc(arc["current_phase_index"]), 0), moments.length - 1) : moments.length - 1;
  return (
    <FieldBlock label="Character Arc">
      <div className="cp-arc">
        <div><div className="l">Story progression</div><div className="c">{moments.length} milestones recorded</div></div>
        <div className="pg" aria-label={`Current milestone ${at + 1} of ${moments.length}`}><span>Current</span><strong>{String(at + 1).padStart(2, "0")}</strong><span aria-hidden="true">/</span><span>{String(moments.length).padStart(2, "0")}</span></div>
      </div>
      {moments.length > 4 && <div className="cp-wide" aria-hidden="true">Scroll the timeline to explore every milestone&nbsp;→</div>}
      <div className="cp-vp">
        <ol className="cp-ms" aria-label="Character arc milestones">{moments.map((m, i) => (
          <li key={i} className={i < at ? "done" : i === at ? "cur" : ""} aria-current={i === at ? "step" : undefined}>
            <span className="tk" aria-hidden="true" /><span className="mk" aria-hidden="true" />
            <div className="mb"><i aria-hidden="true">{String(i + 1).padStart(2, "0")}</i><span>{m}</span></div>
          </li>
        ))}</ol>
      </div>
    </FieldBlock>
  );
}

const firstFilled = (data: Rec, b: Block): unknown => b.keys.map((k) => pluck(data, k)).find((v) => !isEmpty(v));

function blockBody(b: Block, data: Rec): ReactNode {
  if (b.keys.length === 1 || b.first) return <Value v={firstFilled(data, b)} />;
  return <div className="cp-kv">{b.keys.filter((k) => !isEmpty(pluck(data, k))).map((k) => <div key={k}><span className="k">{titled(k)}</span><div className="x"><Value v={pluck(data, k)} /></div></div>)}</div>;
}

/** Every type's body: tiles, blocks, then Other Fields (what no block names and the header does not show). */
export function EntryBody({ type, data }: { type: EntryType; data: Rec }): JSX.Element {
  const layout = LAYOUTS[type];
  const named = new Set([...HEADER_FIELDS, ...layout.flatMap((b) => b.keys.map((k) => k.split(".")[0]!))]);
  const other = Object.keys(data).filter((k) => !named.has(k) && !isEmpty(data[k]));
  const out: JSX.Element[] = [];
  let run: Block[] = [];
  const flush = (): void => {
    for (let i = 0; i < run.length; i += 3) {
      const chunk = run.slice(i, i + 3);
      if (i > 0 && chunk.every((b) => isEmpty(firstFilled(data, b)))) continue;
      out.push(<div key={`t${out.length}`} className="cp-tiles3">{chunk.map((b) => <FieldBlock key={b.label} label={b.label} tile>{isEmpty(firstFilled(data, b)) ? <div className="cp-txt">{BLANK}</div> : <Value v={firstFilled(data, b)} />}</FieldBlock>)}</div>);
    }
    run = [];
  };
  for (const b of layout) {
    if (b.tile) { run.push(b); continue; }
    flush();
    if (b.arc) { const a = <Arc key={b.label} data={data} />; if (!isEmpty(pluck(data, "arc"))) out.push(a); continue; }
    if (b.keys.every((k) => isEmpty(pluck(data, k)))) continue;
    const n = Array.isArray(pluck(data, b.keys[0]!)) ? (pluck(data, b.keys[0]!) as unknown[]).length : 0;
    out.push(<FieldBlock key={b.label} label={b.count && n > 0 ? `${b.label} ${GLYPH.dot} ${n}` : b.label}>{blockBody(b, data)}</FieldBlock>);
  }
  flush();
  if (other.length > 0) out.push(<FieldBlock key="other" label="Other Fields"><div className="cp-kv">{other.map((k) => <div key={k}><span className="k">{titled(k)}</span><div className="x"><Value v={data[k]} /></div></div>)}</div></FieldBlock>);
  return <>{out.length > 0 ? out : <div className="cp-quiet">No structured data for this entry.</div>}<Issues type={type} data={data} /></>;
}

/** A known field holding the wrong kind of value is said so, not hidden (the parser reports it; nothing is changed). */
function Issues({ type, data }: { type: EntryType; data: Rec }): JSX.Element | null {
  const { issues } = parseStructured(type, data);
  return issues.length === 0 ? null : <div className="cp-quiet">{issues.map((i) => `${titled(i.field)} should be ${i.expected}.`).join(" ")}</div>;
}
