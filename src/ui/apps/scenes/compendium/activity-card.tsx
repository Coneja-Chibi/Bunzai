/**
 * One card of the Activity feed (RoleCall `LorebookActivityFeed.tsx` card, rc-world-comp-activity.png): the icon and label, an
 * Error chip, the phase and model chips, the line and its time, the entries it touched as chips (a PRE card: its title, book,
 * Retrieved and token count), an expandable Details, and for a recalled entry "Why this entry". Bunraku adds Undo and File again,
 * which RoleCall's feed has no equivalent of (04b F25). Colours are theme tokens; the 6px left edge takes the phase's colour.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { ENTRY_TYPE_INFO } from "../../../../core/compendium";
import { ago, type ActivityRow } from "./activity-core";

export interface CardActions { undo(id: string): void; again(id: string): void; busy: boolean }

const OPEN = "\u25BE";
const SHUT = "\u25B8";

export function ActivityCard({ row, now, actions }: { row: ActivityRow; now: number; actions: CardActions }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const detailed = row.lines.length > 0 || row.reason !== undefined;
  const rc = row.recalled;
  return (
    <div className={`cp-act ${row.phase.toLowerCase()}${row.error ? " bad" : ""}`} data-part="compendium.activity.card" {...(row.card ? { "data-card": row.card } : {})}>
      <span className="ico"><Ic name={row.error ? "lucide:circle-alert" : row.phase === "PRE" || row.phase === "LIVE" ? "lucide:search" : row.card === "standardize" ? "lucide:layers" : row.label === "Undone" || row.card === "revert" ? "lucide:rotate-ccw" : "lucide:zap"} size={14} /></span>
      <div className="bd">
      <div className="top">
        <b className="lab">{row.label}</b>
        {row.error && <span className="chip err">{row.status}</span>}
        <span className="chip phase">{row.phase}</span>
        {row.model && <span className="chip model">{row.model}</span>}
        <small className="when">{ago(row.at, now)}</small>
      </div>
      <p className="txt">{row.text}</p>
      {(row.lines.length > 0 || rc || row.retrieved) && (
        <div className="chips">
          {rc && (
            <>
              <span className="chip ent">{rc.title}</span>
              <span className="chip">{rc.book}</span>
              <span className="chip trig">{rc.trigger}</span>
              <span className="chip tok">{rc.tokens.toLocaleString()} tokens</span>
            </>
          )}
          {row.retrieved?.map((e, i) => <span key={i} className="chip ent">{e.title} <small>{e.book}, {e.tokens.toLocaleString()} tokens</small></span>)}
          {row.lines.map((l) => <span key={`${l.bookId}:${l.entryId}`} className="chip ent" style={l.type ? { "--tc": `var(${ENTRY_TYPE_INFO[l.type].token})` } as React.CSSProperties : undefined}>{l.name} <small>{l.verb}</small></span>)}
        </div>
      )}
      {(detailed || row.why || row.canUndo || row.canFileAgain) && (
        <div className="foot">
          {detailed && <button type="button" className="lnk" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? OPEN : SHUT} Details</button>}
          {row.why && <button type="button" className="lnk" aria-expanded={whyOpen} onClick={() => setWhyOpen(!whyOpen)}><Ic name="lucide:message-square" size={12} /> {whyOpen ? OPEN : SHUT} Why this entry</button>}
          {row.canUndo && <button type="button" className="act" disabled={actions.busy} onClick={() => actions.undo(row.id)}><Ic name="lucide:rotate-ccw" size={12} /> Undo</button>}
          {row.canFileAgain && <button type="button" className="act" disabled={actions.busy} onClick={() => actions.again(row.id)}><Ic name="lucide:refresh-cw" size={12} /> File again</button>}
        </div>
      )}
      {open && (
        <div className="det">
          {row.lines.map((l) => <div key={`${l.bookId}:${l.entryId}`}><b>{l.name}</b> {l.verb}{l.fields.length > 0 ? `: ${l.fields.join(", ")}` : ""}</div>)}
          {row.reason && <div className="why">{row.reason}</div>}
        </div>
      )}
      {whyOpen && row.why && <div className="det reason">{row.why}</div>}
      </div>
    </div>
  );
}
