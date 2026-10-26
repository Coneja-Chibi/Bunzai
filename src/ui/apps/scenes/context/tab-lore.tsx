/**
 * Lore & state's Lore view (RoleCall `DebugWingPanelV2.tsx` LoreTab): "Search entries...", the entries that went into the reply grouped by book (`N entries`), each row its title, loop
 * (`L<n>`), tokens and a fold that reads "Matched: <keys>"; "N entries" and the tokens in the footer. The data is the trace's own lore (TrackHare's), so it adds what RoleCall's tab did
 * not show: why each fired, the entries cut for the lore share, the Compendium's recall, and a "Didn't fire" list. It works with the TrackHare Prop off.
 */
import { useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import { VirtualRows } from "../../../_shared/virtual-list";
import { Disclosure } from "../../../components/button";
import type { SceneTrace, TraceLoreHit } from "../../../app-contract-scenes";
import { bookGroups, reasonBadge, rollBadge } from "../props/trackhare/hare-core";

const matches = (q: string, ...texts: string[]): boolean => q === "" || texts.some((t) => t.toLowerCase().includes(q));

/** One line of the windowed list: a book heading, an entry, or the "Didn't fire" toggle. The last line of a section carries the gap before the next. */
type LoreRow = { key: string; node: ReactNode; end?: boolean };
const ROW_ESTIMATE_PX = 44;

function Entry({ hit, chains, cut, open, onToggle }: { hit: TraceLoreHit; chains: NonNullable<SceneTrace["lore"]>["chains"]; cut?: boolean; open: boolean; onToggle: () => void }): JSX.Element {
  const badge = reasonBadge(hit, chains);
  const roll = rollBadge(hit);
  return (
    <div>
      <div className="ls-node lore" style={{ "--c": badge.tone } as CSSProperties} onClick={onToggle}>
        <span className="ls-name">{hit.title}<small>{cut ? "left out for space" : badge.text}</small></span>
        {hit.loop > 0 && <span className="ls-loop">L{hit.loop}</span>}
        <span className="ls-num">{hit.tokens.toLocaleString()}</span>
        <Ic name={open ? "lucide:chevron-down" : "lucide:chevron-right"} size={12} />
      </div>
      {open && (
        <div className="ls-body">
          {hit.matched.length > 0 && <p><span>Matched: </span><b>{hit.matched.join(", ")}</b></p>}
          <p><span>Position: </span>{hit.place}</p>
          {roll && <p><span>{roll.text}</span></p>}
        </div>
      )}
    </div>
  );
}

export function Lore({ trace }: { trace: SceneTrace }): JSX.Element {
  const [query, setQuery] = useState("");
  const [misses, setMisses] = useState(false);
  const q = query.trim().toLowerCase();
  const lore = trace.lore;
  const chains = lore?.chains ?? [];
  const fired = (lore?.injected ?? []).filter((h) => matches(q, h.title, ...h.matched));
  const cut = (lore?.cut ?? []).filter((h) => matches(q, h.title, ...h.matched));
  const recalled = (trace.recall?.injected ?? []).filter((h) => matches(q, h.title));
  const missed = lore?.missed ?? [];
  const groups = bookGroups(fired);
  const count = fired.length + recalled.length;
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string): void => setOpened((prev) => { const next = new Set(prev); if (!next.delete(key)) next.add(key); return next; });
  const entry = (section: string, h: TraceLoreHit, isCut?: boolean): LoreRow => {
    const key = `${section}:${h.bookId}:${h.entryId}`;
    return { key, node: <Entry hit={h} chains={chains} open={opened.has(key)} onToggle={() => toggle(key)} {...(isCut ? { cut: true } : {})} /> };
  };
  const head = (key: string, icon: IconName, title: string, note: ReactNode): LoreRow => ({ key, node: <div className="ls-bk"><Ic name={icon} size={14} /><span>{title}</span><small>{note}</small></div> });
  const sectionEnd = (list: LoreRow[]): LoreRow[] => list.map((r, i) => (i === list.length - 1 ? { ...r, end: true } : r));
  const entries = (n: number): string => `${n} ${n === 1 ? "entry" : "entries"}`;
  const rows: LoreRow[] = [
    ...groups.flatMap((g) => sectionEnd([head(`book:${g.bookName}`, "lucide:library", g.bookName, entries(g.hits.length)), ...g.hits.map((h) => entry("fired", h))])),
    ...(recalled.length === 0 ? [] : sectionEnd([
      head("recalled", "lucide:library", "Recalled by the Compendium", entries(recalled.length)),
      ...recalled.map((h) => ({ key: `recalled:${h.bookId}:${h.entryId}`, node: <div className="ls-node lore" style={{ "--c": "var(--deck-lorebook)" } as CSSProperties}><span className="ls-name">{h.title}<small>{h.reason || "Picked by the Compendium"} · {h.bookName}</small></span><span className="ls-num">{h.tokens.toLocaleString()}</span></div> })),
    ])),
    ...(cut.length === 0 ? [] : sectionEnd([head("cut", "lucide:minus", "Left out for space", cut.length), ...cut.map((h) => entry("cut", h, true))])),
    ...(missed.length === 0 ? [] : sectionEnd([
      { key: "missed", node: <Disclosure open={misses} onClick={() => setMisses(!misses)} label={`Didn't fire (${missed.length})`} /> },
      ...(misses ? missed.filter((m) => matches(q, m.title, m.why)).map((m) => ({ key: `missed:${m.bookId}:${m.entryId}`, node: <div className="ls-node lore" style={{ "--c": "var(--stage-mute)" } as CSSProperties}><span className="ls-name">{m.title}<small>{m.why}</small></span></div> })) : []),
    ])),
  ];
  return (
    <div className="ls-pane">
      <div className="ls-search"><Ic name="lucide:search" size={14} /><input type="search" placeholder="Search entries..." aria-label="Search entries" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className="ls-list">
        {count === 0 && cut.length === 0 && <div className="ls-none"><Ic name="lucide:compass" size={24} /><p>{q ? "No matching entries" : "No lorebook entries active"}</p></div>}
        <VirtualRows items={rows} keyOf={(r) => r.key} estimate={ROW_ESTIMATE_PX} render={(r) => (r.end ? <div className="ls-end">{r.node}</div> : r.node)} />
      </div>
      <div className="ls-foot"><span>{count} entries</span><span>{(fired.reduce((n, h) => n + h.tokens, 0) + recalled.reduce((n, h) => n + h.tokens, 0)).toLocaleString()} tokens</span></div>
    </div>
  );
}
