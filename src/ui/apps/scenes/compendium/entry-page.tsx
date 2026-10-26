/**
 * An entry's page, the "dossier" (RoleCall `CodexDetailPane.tsx:331-640`): the breadcrumb (a place walks its parent chain), the
 * hero (portrait or initials in the type colour, the type chip, the name, the tagline, a rule, the description), the typed body,
 * Linked Entries and, for a character, who else names them. Read-only: no star, no actions menu, no edit (A5 brings them with
 * their writes). The portrait is initials only: an `image_url` in an imported book can be a remote address, and viewing a book
 * must not fetch from the network.
 */
import type { CSSProperties, JSX } from "react";
import { Chip, ListRow } from "../../../components/button";
import { ENTRY_TYPE_INFO, backlinksOf, linksOf, type CompendiumEntry } from "../../../../core/compendium";
import { GLYPH, initialsOf, titled, typeRole, type BookModel } from "./compendium-core";
import { EntryBody, FieldBlock } from "./fields/blocks";

/** A place's ancestors by `parent_location` name, nearest last; a cycle or a missing parent ends the walk. */
function placeChain(e: CompendiumEntry, m: BookModel): string[] {
  const byName = new Map(m.entries.filter((x) => x.type === "location").map((x) => [x.name.toLowerCase(), x]));
  const chain: string[] = [];
  const seen = new Set([e.id]);
  let parent = typeof e.data["parent_location"] === "string" ? e.data["parent_location"].trim() : "";
  while (parent && chain.length < 12) {
    const p = byName.get(parent.toLowerCase());
    if (!p || seen.has(p.id)) break;
    seen.add(p.id);
    chain.unshift(p.name);
    parent = typeof p.data["parent_location"] === "string" ? p.data["parent_location"].trim() : "";
  }
  return chain;
}

function Linked({ m, id, onOpen }: { m: BookModel; id: string; onOpen(id: string): void }): JSX.Element | null {
  const { outgoing, incoming } = linksOf(m.graph, id);
  if (outgoing.length === 0 && incoming.length === 0) return null;
  const grouped = (edges: typeof outgoing, side: "to" | "from"): [string, { id: string; name: string }[]][] => {
    const map = new Map<string, Map<string, string>>();
    for (const e of edges) {
      const other = side === "to" ? e.toId! : e.fromId;
      map.set(e.edge, (map.get(e.edge) ?? new Map()).set(other, m.byId.get(other)?.name ?? other));
    }
    return [...map].map(([edge, ids]) => [edge, [...ids].map(([i, name]) => ({ id: i, name }))]);
  };
  const part = (title: string, groups: ReturnType<typeof grouped>): JSX.Element => (
    <div><div className="lt">{title}</div>{groups.map(([edge, list]) => (
      <div key={edge} className="lr"><span>{titled(edge)}</span><div>{list.map((l) => <Chip key={l.id} onClick={() => onOpen(l.id)}>{l.name}</Chip>)}</div></div>
    ))}</div>
  );
  return (
    <div className="cp-linked">
      <div className="ln">{GLYPH.star} Linked Entries</div>
      {incoming.length > 0 && part(`Linked From (${incoming.length})`, grouped(incoming, "from"))}
      {outgoing.length > 0 && part(`Links To (${outgoing.length})`, grouped(outgoing, "to"))}
    </div>
  );
}

function ReferencedBy({ m, e, onOpen }: { m: BookModel; e: CompendiumEntry; onOpen(id: string): void }): JSX.Element | null {
  const bySource = new Map(backlinksOf(m.rels, e.title).filter((x) => x.sourceEntryId !== e.id).map((x) => [x.sourceEntryId, x]));
  if (bySource.size === 0) return null;
  const ours = new Set((Array.isArray(e.data["relationships"]) ? (e.data["relationships"] as { with?: unknown }[]) : []).map((r) => (typeof r.with === "string" ? r.with.trim().toLowerCase() : "")).filter(Boolean));
  const rows = [...bySource.values()];
  const group = (title: string, list: typeof rows): JSX.Element | null => list.length === 0 ? null : (
    <div><div className="lt">{title}</div>{list.map((x) => (
      <ListRow key={x.sourceEntryId} label={x.sourceTitle} subtitle={x.notes || undefined} meta={x.nature ?? GLYPH.dot} onClick={() => onOpen(x.sourceEntryId)} />
    ))}</div>
  );
  return (
    <FieldBlock label={`Referenced By (${rows.length})`}>
      {group(`One-Sided ${GLYPH.dot} Not Reciprocated`, rows.filter((x) => !ours.has(x.sourceTitle.toLowerCase())))}
      {group(`Mutual ${GLYPH.dot} Both Sides Acknowledged`, rows.filter((x) => ours.has(x.sourceTitle.toLowerCase())))}
    </FieldBlock>
  );
}

export function EntryPage({ m, id, bookName, onOpen }: { m: BookModel; id: string; bookName: string; onOpen(id: string): void }): JSX.Element {
  const e = m.byId.get(id);
  if (!e) return <div className="cp-load bad">Entry not found</div>;
  const info = e.type ? ENTRY_TYPE_INFO[e.type] : null;
  const crumbs = [bookName, e.type === "location" ? "Places" : info?.label ?? BLANK_TYPE, ...(e.type === "location" ? placeChain(e, m) : []), e.name];
  const blurb = typeof e.data["description"] === "string" ? e.data["description"] : typeof e.data["summary"] === "string" ? e.data["summary"] : "";
  const subtitle = typeof e.data["subtitle"] === "string" ? e.data["subtitle"] : "";
  return (
    <article className="cp-page" style={{ "--tc": typeRole(e.type) } as CSSProperties} data-part="compendium.entry">
      <header className="ph"><div className="crumb2">{crumbs.flatMap((c, i) => [<span key={`c${i}`} className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>, ...(i < crumbs.length - 1 ? [<span key={`s${i}`}>{GLYPH.sep}</span>] : [])])}</div></header>
      <div className="pb">
        <div className="hero">
          <div className="por" aria-hidden="true">{initialsOf(e.name)}</div>
          <div className="hb">
            <div className="tr"><span className="tchip">{GLYPH.star} {info?.label ?? "Entry"}</span>{subtitle && <span className="sub">{subtitle}</span>}</div>
            <h1>{e.name}</h1>
            {e.tagline && <p className="tg">{e.tagline}</p>}
            <div className="rule" />
            {blurb && <p className="ds">{blurb}</p>}
          </div>
        </div>
        {e.type ? <EntryBody type={e.type} data={e.data} /> : <div className="cp-quiet">No structured data for this entry.</div>}
        {e.type === "character" && <ReferencedBy m={m} e={e} onOpen={onOpen} />}
        <Linked m={m} id={id} onOpen={onOpen} />
      </div>
    </article>
  );
}

const BLANK_TYPE = "Entry";
