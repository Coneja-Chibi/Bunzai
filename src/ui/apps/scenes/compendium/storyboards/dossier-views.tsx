/**
 * The four dossiers' bodies (RoleCall `dossiers/{quests,cast,map,renown}/*`), each a view of what core/compendium/dossiers built from the book's entries.
 * A card opens its entry in Browse (RoleCall's pencil, "Edit in Compendium", `DossierCardActions.tsx`): the entries are the data, so editing happens there.
 * Quest Board has RoleCall's Pressure Board lanes and Journal; Cast a list with the selected case file; Map and Renown a list. Not drawn, because they
 * read the Story Director's journal or invent data: the Dependency Tree, History, Corrections and Promote tabs, RoleCall's Relationship Graph and Atlas,
 * its consequence tree and its failure-pressure "ramp" (a made-up series), and Calendar.
 */
import { useState, type JSX } from "react";
import type { CastDossier, CastMember, MapDossier, QuestItem, QuestsDossier, RenownDossier } from "../../../../../core/compendium/dossiers";
import { Empty, Meter, Section, Tabs, type Tone } from "./dossier-parts";

type Open = (entryId: string) => void;
const MARK = { done: "✓", open: "○", failed: "✕", blocked: "!" } as const;

const Chip = ({ children, tone }: { children: string; tone?: Tone }): JSX.Element => <span className="sb-chip" style={tone ? { color: `var(--stage-${tone === "danger" ? "danger-text" : tone})` } : undefined}>{children}</span>;

function QuestCard({ q, open }: { q: QuestItem; open: Open }): JSX.Element {
  const tone: Tone = q.urgency >= 75 ? "danger" : q.urgency >= 50 ? "warn" : "ok";
  return (
    <article className="sb-card" role="button" tabIndex={0} onClick={() => open(q.id)} onKeyDown={(e) => { if (e.key === "Enter") open(q.id); }} data-part="compendium.dossier.card">
      <header><b>{q.name}</b>{q.type && <Chip>{q.type}</Chip>}<Chip tone={tone}>{q.status.replace(/_/g, " ")}</Chip></header>
      {(q.tagline ?? q.description) && <p>{q.tagline ?? q.description}</p>}
      <Meter label="Urgency" value={q.urgency} tone={tone} />
      <div className="sb-facts">{q.progress && <span>Progress {q.progress}</span>}{q.deadline && <span>Deadline {q.deadline}</span>}</div>
      {q.objectives.length > 0 && <ul className="sb-objs">{q.objectives.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (o) => <li key={o.id} data-status={o.status}><i>{MARK[o.status]}</i>{o.description}</li>)}</ul>}
      {[...q.characters, ...q.locations, ...q.items].length > 0 && <div className="sb-links">{[...q.characters, ...q.locations, ...q.items].map((n) => <Chip key={n}>{n}</Chip>)}</div>}
    </article>
  );
}

const lanes = (d: QuestsDossier): { title: string; sub: string; tone: Tone; list: QuestItem[] }[] => [
  { title: "Critical Path", sub: "narrative-locking", tone: "danger", list: d.critical },
  { title: "Active", sub: "in motion", tone: "ok", list: d.active },
  { title: "Blocked", sub: "awaiting a beat", tone: "warn", list: d.blocked },
  { title: "Failed / Abandoned", sub: "cascade source", tone: "danger", list: d.failed },
];

export function QuestsBody({ d, open, ai }: { d: QuestsDossier; open: Open; ai: JSX.Element }): JSX.Element {
  const [tab, setTab] = useState<"pressure" | "journal" | "ai">("pressure");
  const all = [...d.critical, ...d.active, ...d.blocked, ...d.completed, ...d.failed];
  const total = new Set(all.map((q) => q.id)).size;
  return (
    <>
      <Tabs<"pressure" | "journal" | "ai"> label="Quest dossier sections" active={tab} onChange={setTab} tabs={[{ id: "pressure", label: "Pressure Board", count: "Live" }, { id: "journal", label: "Journal", count: total }, { id: "ai", label: "AI Context", count: `${d.ai.tokens} tok` }]} />
      {tab === "pressure" && (
        <div className="sb-split">
          <div>{lanes(d).map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (l) => <Section key={l.title} title={l.title} sub={l.sub} tone={l.tone}>{l.list.length === 0 ? <Empty>Nothing here.</Empty> : l.list.map((q) => <QuestCard key={`${l.title}:${q.id}`} q={q} open={open} />)}</Section>)}</div>
          <aside><Meter label="Failure pressure" value={d.stats.failurePressure} tone={d.stats.failurePressure >= 75 ? "danger" : "warn"} />{ai}</aside>
        </div>
      )}
      {tab === "journal" && (total === 0 ? <Empty>No quests yet. Plots in the Compendium appear here.</Empty> : <div>{[...new Map(all.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (q) => [q.id, q])).values()].map((q) => <QuestCard key={q.id} q={q} open={open} />)}</div>)}
      {tab === "ai" && ai}
    </>
  );
}

function CaseFile({ m, open }: { m: CastMember; open: Open }): JSX.Element {
  return (
    <article className="sb-card" onClick={() => open(m.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") open(m.id); }} data-part="compendium.dossier.card">
      <header><b>{m.name}</b>{m.role && <Chip>{m.role}</Chip>}{m.category && <Chip>{m.category}</Chip>}{m.inScene && <Chip tone="ok">In scene</Chip>}</header>
      {m.emotion && <p>{m.emotion}{m.emotionIntensity !== null ? ` (${m.emotionIntensity})` : ""}{m.emotionCause ? `: ${m.emotionCause}` : ""}</p>}
      {m.metrics.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (x) => <Meter key={x.id} label={x.label} value={x.value} max={x.max} tone="pink" />)}
      {m.memories.length > 0 && <ul className="sb-objs">{m.memories.map((x) => <li key={x.id} data-status={x.impact === "negative" ? "failed" : "open"}><i>{x.weight >= 8 ? "★" : "○"}</i>{x.text}</li>)}</ul>}
      {m.relationships.length > 0 && <div className="sb-links">{m.relationships.map((r) => <Chip key={r.target}>{r.nature ? `${r.target} (${r.nature})` : r.target}</Chip>)}</div>}
    </article>
  );
}

export function CastBody({ d, open, ai }: { d: CastDossier; open: Open; ai: JSX.Element }): JSX.Element {
  const [tab, setTab] = useState<"cast" | "ai">("cast");
  return (
    <>
      <Tabs<"cast" | "ai"> label="Cast dossier sections" active={tab} onChange={setTab} tabs={[{ id: "cast", label: "Cast", count: d.stats.totalCast }, { id: "ai", label: "AI Context", count: `${d.ai.tokens} tok` }]} />
      {tab === "ai" ? ai : d.cast.length === 0 ? <Empty>No characters yet. Characters in the Compendium appear here.</Empty> : (
        <div>
          <Section title="In the scene" tone="ok">{d.cast.filter((m) => m.inScene).map((m) => <CaseFile key={m.id} m={m} open={open} />)}</Section>
          <Section title="Offstage" tone="pink">{d.cast.filter((m) => !m.inScene).map((m) => <CaseFile key={m.id} m={m} open={open} />)}</Section>
          {d.mismatches > 0 && <p className="sb-note">{d.mismatches} relationship{d.mismatches === 1 ? "" : "s"} named by one side only.</p>}
        </div>
      )}
    </>
  );
}

export function MapBody({ d, open, ai }: { d: MapDossier; open: Open; ai: JSX.Element }): JSX.Element {
  const [tab, setTab] = useState<"places" | "ai">("places");
  return (
    <>
      <Tabs<"places" | "ai"> label="Map dossier sections" active={tab} onChange={setTab} tabs={[{ id: "places", label: "Locations", count: d.stats.knownLocations }, { id: "ai", label: "AI Context", count: `${d.ai.tokens} tok` }]} />
      {tab === "ai" ? ai : d.locations.length === 0 ? <Empty>No locations yet. Places in the Compendium appear here.</Empty> : (
        <div>{d.locations.map((l) => (
          <article className="sb-card" key={l.id} role="button" tabIndex={0} onClick={() => open(l.id)} onKeyDown={(e) => { if (e.key === "Enter") open(l.id); }}>
            <header><b>{l.name}</b><Chip>{l.type}</Chip>{l.danger && <Chip tone={l.danger === "high" || l.danger === "extreme" ? "danger" : "ok"}>{`danger ${l.danger}`}</Chip>}{l.visited && <Chip tone="ok">Visited</Chip>}</header>
            {l.region && <div className="sb-facts"><span>Region {l.region}</span></div>}
            {l.description && <p>{l.description}</p>}
          </article>
        ))}</div>
      )}
    </>
  );
}

export function RenownBody({ d, open, ai }: { d: RenownDossier; open: Open; ai: JSX.Element }): JSX.Element {
  const [tab, setTab] = useState<"standings" | "ai">("standings");
  return (
    <>
      <Tabs<"standings" | "ai"> label="Renown dossier sections" active={tab} onChange={setTab} tabs={[{ id: "standings", label: "Standings", count: d.stats.standings }, { id: "ai", label: "AI Context", count: `${d.ai.tokens} tok` }]} />
      {tab === "ai" ? ai : d.standings.length === 0 ? <Empty>No standings yet. Organizations in the Compendium appear here.</Empty> : (
        <div>{d.standings.map((s) => (
          <article className="sb-card" key={s.id} role="button" tabIndex={0} onClick={() => open(s.id)} onKeyDown={(e) => { if (e.key === "Enter") open(s.id); }}>
            <header><b>{s.name}</b><Chip>{s.entityType}</Chip>{s.kind && <Chip>{s.kind}</Chip>}{s.heat >= 70 && <Chip tone="danger">Wanted</Chip>}</header>
            <Meter label="Reputation" value={s.reputation} max={100} tone={s.reputation < 0 ? "danger" : "ok"} />
            <Meter label="Heat" value={s.heat} tone={s.heat >= 70 ? "danger" : "warn"} />
            <div className="sb-facts">{s.region && <span>Region {s.region}</span>}<span>Favors banked {s.banked}</span><span>Owed {s.owed}</span>{s.heatLabel && <span>{s.heatLabel}</span>}</div>
          </article>
        ))}</div>
      )}
    </>
  );
}
