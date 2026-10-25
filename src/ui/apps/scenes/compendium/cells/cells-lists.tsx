/**
 * The Dashboard's list cells and the strip above the masonry (RoleCall `BentoDashboard.tsx:1457-1582,1698-1838,1863-1897`):
 * World Concepts, Of Note (item, org, event), Entry Counts, Recent Writes, Plots in Motion, Threat Radar, Historian's Recaps.
 * Every cell reads the Dashboard the core derived; none walks the book. Copy is RoleCall's, empty lines included.
 */
import type { CSSProperties, JSX } from "react";
import { canonicalSeverity, type CompendiumEntry, type Dashboard, type EntryType } from "../../../../../core/compendium";
import { BLANK, GLYPH, severityRole, severityStep, titled, typeRole } from "../compendium-core";
import { Cell, Empty, Hit } from "./cell";

type Open = { onOpen(id: string): void };
const tc = (type: string | null): CSSProperties => ({ "--tc": typeRole(type) } as CSSProperties);
const str = (e: CompendiumEntry | undefined, key: string): string => (typeof e?.data[key] === "string" ? (e.data[key] as string) : "");
const count = (e: CompendiumEntry | undefined, key: string): number => (Array.isArray(e?.data[key]) ? (e.data[key] as unknown[]).length : 0);
const joined = (parts: readonly string[]): string => parts.filter(Boolean).join(` ${GLYPH.dot} `);

export function WorldConcepts({ d, onOpen }: { d: Dashboard } & Open): JSX.Element {
  const shown = d.worldConcepts.slice(0, 24);
  return (
    <Cell title="World Concepts" dot={typeRole("worldbuilding")}>
      {shown.length === 0 ? <Empty>{d.counts.worldbuilding ? `${d.counts.worldbuilding} concepts indexed.` : "No concepts yet."}</Empty> : (
        <div className="cp-rail" style={tc("worldbuilding")}>
          {shown.map((w) => <Hit key={w.id} id={w.id} onOpen={onOpen} className="chip"><b>{str(w, "topic") || w.name || BLANK}</b>{str(w, "category") && <small>{str(w, "category")}</small>}</Hit>)}
          {d.worldConcepts.length > 24 && <span className="more">+{d.worldConcepts.length - 24} more</span>}
        </div>
      )}
    </Cell>
  );
}

const OF_NOTE: readonly { type: "item" | "organization" | "event"; label: string; foot(e: CompendiumEntry | undefined): string }[] = [
  { type: "item", label: "ITEM", foot: (e) => joined([str(e, "current_owner") && `Owner: ${str(e, "current_owner")}`, str(e, "condition")]) },
  { type: "organization", label: "ORG", foot: (e) => joined([Array.isArray(e?.data["members"]) ? `${count(e, "members")} members` : "", str(e, "leader") && `Led by ${str(e, "leader")}`]) },
  { type: "event", label: "EVENT", foot: (e) => joined([str(e, "when"), Array.isArray(e?.data["participants"]) ? `${count(e, "participants")} participants` : ""]) },
];

export function OfNote({ d, onOpen }: { d: Dashboard } & Open): JSX.Element {
  return (
    <div className="cp-note3">
      {OF_NOTE.map(({ type, label, foot }) => {
        const e = d.featured[type];
        return (
          <button key={type} type="button" className="cp-of" style={tc(type)} disabled={!e} onClick={() => e && onOpen(e.id)}>
            <span className="k">{label}</span>
            <span className="n">{e?.name ?? BLANK}</span>
            {e?.tagline && <span className="t">{e.tagline}</span>}
            <span className="f">{foot(e)}</span>
          </button>
        );
      })}
    </div>
  );
}

const COUNTS: readonly [EntryType, string][] = [["character", "Cast"], ["location", "Places"], ["item", "Items"], ["organization", "Orgs"], ["event", "Events"], ["plot", "Plots"], ["threat", "Threats"], ["worldbuilding", "World"], ["creature", "Beasts"], ["summary", "Recaps"]];

export function EntryCounts({ d }: { d: Dashboard }): JSX.Element {
  return (
    <Cell title="Entry Counts">
      <div className="cp-counts">
        {COUNTS.map(([type, label]) => <div key={type} style={tc(type)}><span className="v">{d.counts[type]}</span><span className="l">{label}</span></div>)}
      </div>
    </Cell>
  );
}

/** What the receipts (Track C) say was written, newest first; RoleCall's list is the six newest `updated_at` rows (F15). */
export interface RecentWrite { entryId: string; name: string; type: EntryType | null; detail: string; at: string }

export function RecentWrites({ writes, onOpen }: { writes: readonly RecentWrite[] } & Open): JSX.Element {
  return (
    <Cell title="Recent Writes">
      {writes.length === 0 ? <Empty>No recent writes yet.</Empty> : writes.slice(0, 6).map((w) => (
        <Hit key={`${w.entryId}:${w.at}`} id={w.entryId} onOpen={onOpen} className="cp-rw" style={tc(w.type)}>
          <span>{w.name} {GLYPH.dot} <small>{w.detail}</small></span><small className="when">{w.at}</small>
        </Hit>
      ))}
    </Cell>
  );
}

export function PlotsInMotion({ d, onOpen }: { d: Dashboard } & Open): JSX.Element {
  return (
    <Cell title="Plots in Motion" dot={typeRole("plot")}>
      {d.activePlots.length === 0 ? <Empty>No active plots.</Empty> : d.activePlots.slice(0, 5).map((p) => (
        <Hit key={p.id} id={p.id} onOpen={onOpen} className="cp-plot" style={tc("plot")}>
          <span className="r"><span className="n">{p.name}</span><span className="badge">{str(p, "status") || "active"}</span></span>
          {p.tagline && <small>{p.tagline}</small>}
        </Hit>
      ))}
    </Cell>
  );
}

export function ThreatRadar({ d, onOpen }: { d: Dashboard } & Open): JSX.Element {
  return (
    <Cell title="Threat Radar" dot={typeRole("threat")}>
      {d.activeThreats.length === 0 ? <Empty>No active threats.</Empty> : d.activeThreats.slice(0, 5).map((t) => {
        const sev = canonicalSeverity(str(t, "severity"));
        const step = severityStep(sev);
        const status = str(t, "status");
        const scope = str(t, "scope");
        return (
          <Hit key={t.id} id={t.id} onOpen={onOpen} className={`cp-threat ${severityRole(step)}`}>
            <span className="r"><span className="n">{t.name}</span><span className="sev">{GLYPH.starOn.repeat(step)}{GLYPH.starOff.repeat(5 - step)} {titled(sev)}</span></span>
            <span className="bar"><span style={{ width: `${step * 20}%` }} /></span>
            {(status || scope) && <small>{joined([status && `Status: ${status}`, scope && `Scope: ${scope}`])}</small>}
          </Hit>
        );
      })}
    </Cell>
  );
}

export function Recaps({ d, onOpen }: { d: Dashboard } & Open): JSX.Element {
  return (
    <Cell title="Historian's Recaps (by Plot)" dot={typeRole("summary")}>
      <div className="cp-recaps">
        {d.recaps.length === 0 && <Empty>No summaries yet.</Empty>}
        {d.recaps.map((g) => (
          <div key={g.plot} className="g" style={tc("plot")}>
            <div className="h">PLOT {GLYPH.sep} {g.plot.toUpperCase()}</div>
            {g.summaries.map((s, i) => <Hit key={s.id} id={s.id} onOpen={onOpen} className="row"><i>{String(i + 1).padStart(2, "0")}</i><span>{s.name || "Untitled"}</span></Hit>)}
          </div>
        ))}
      </div>
    </Cell>
  );
}
