/**
 * Lore & state's Lore view (RoleCall `DebugWingPanelV2.tsx` LoreTab): "Search entries...", the entries that went into the reply grouped by book (`N entries`), each row its title, loop
 * (`L<n>`), tokens and a fold that reads "Matched: <keys>"; "N entries" and the tokens in the footer. The data is the trace's own lore (TrackHare's), so it adds what RoleCall's tab did
 * not show: why each fired, the entries cut for the lore share, the Compendium's recall, and a "Didn't fire" list. It works with the TrackHare Prop off.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { Disclosure } from "../../../components/button";
import type { SceneTrace, TraceLoreHit } from "../../../app-contract-scenes";
import { bookGroups, reasonBadge, rollBadge } from "../props/trackhare/hare-core";

const matches = (q: string, ...texts: string[]): boolean => q === "" || texts.some((t) => t.toLowerCase().includes(q));

function Entry({ hit, chains, cut }: { hit: TraceLoreHit; chains: NonNullable<SceneTrace["lore"]>["chains"]; cut?: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const badge = reasonBadge(hit, chains);
  const roll = rollBadge(hit);
  return (
    <div>
      <div className="ls-node lore" style={{ "--c": badge.tone } as CSSProperties} onClick={() => setOpen(!open)}>
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
  return (
    <div className="ls-pane">
      <div className="ls-search"><Ic name="lucide:search" size={14} /><input type="search" placeholder="Search entries..." aria-label="Search entries" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className="ls-list">
        {count === 0 && cut.length === 0 && <div className="ls-none"><Ic name="lucide:compass" size={24} /><p>{q ? "No matching entries" : "No lorebook entries active"}</p></div>}
        {groups.map((g) => (
          <div className="ls-book" key={g.bookName}>
            <div className="ls-bk"><Ic name="lucide:library" size={14} /><span>{g.bookName}</span><small>{g.hits.length} {g.hits.length === 1 ? "entry" : "entries"}</small></div>
            {g.hits.map((h) => <Entry key={`${h.bookId}:${h.entryId}`} hit={h} chains={chains} />)}
          </div>
        ))}
        {recalled.length > 0 && (
          <div className="ls-book">
            <div className="ls-bk"><Ic name="lucide:library" size={14} /><span>Recalled by the Compendium</span><small>{recalled.length} {recalled.length === 1 ? "entry" : "entries"}</small></div>
            {recalled.map((h) => <div className="ls-node lore" style={{ "--c": "var(--deck-lorebook)" } as CSSProperties} key={`${h.bookId}:${h.entryId}`}><span className="ls-name">{h.title}<small>{h.reason || "Picked by the Compendium"} · {h.bookName}</small></span><span className="ls-num">{h.tokens.toLocaleString()}</span></div>)}
          </div>
        )}
        {cut.length > 0 && (
          <div className="ls-book">
            <div className="ls-bk"><Ic name="lucide:minus" size={14} /><span>Left out for space</span><small>{cut.length}</small></div>
            {cut.map((h) => <Entry key={`${h.bookId}:${h.entryId}`} hit={h} chains={chains} cut />)}
          </div>
        )}
        {missed.length > 0 && (
          <div className="ls-book">
            <Disclosure open={misses} onClick={() => setMisses(!misses)} label={`Didn't fire (${missed.length})`} />
            {misses && missed.filter((m) => matches(q, m.title, m.why)).map((m) => <div className="ls-node lore" style={{ "--c": "var(--stage-mute)" } as CSSProperties} key={`${m.bookId}:${m.entryId}`}><span className="ls-name">{m.title}<small>{m.why}</small></span></div>)}
          </div>
        )}
      </div>
      <div className="ls-foot"><span>{count} entries</span><span>{(fired.reduce((n, h) => n + h.tokens, 0) + recalled.reduce((n, h) => n + h.tokens, 0)).toLocaleString()} tokens</span></div>
    </div>
  );
}
