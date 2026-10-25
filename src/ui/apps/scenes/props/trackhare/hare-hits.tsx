/**
 * What fired on a reply, shared by TrackHare's popover and its pop-out: the reply line, the lore entries grouped and sorted, the
 * entries the Compendium recalled, and the Didn't-fire section. Presentational: grouping and sorting come from hare-core.ts.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../../_shared/ic";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { bookGroups, reasonBadge, rollBadge, sortHits, type SortMode } from "./hare-core";

export function HareHits({ trace, group, sort, showMisses }: { trace: SceneTrace; group: boolean; sort: SortMode; showMisses: boolean }): JSX.Element {
  const [missesOpen, setMissesOpen] = useState(false);
  const lore = trace.lore;
  const hits = lore ? sortHits(lore.injected, sort) : [];
  const groups = group ? bookGroups(hits) : hits.length > 0 ? [{ bookName: "", hits }] : [];
  const misses = lore?.missed ?? [];
  const recall = trace.recall ?? null;
  return (
    <>
      <div className="hp-sub"><span>Reply #{trace.reply.number} &middot; {trace.reply.take}</span><span>~{lore?.totalTokens ?? 0} lore tok</span></div>
      {lore === null && recall === null && (
        <div className="hare-none">No lorebooks fired in this reply.<span className="hint">Open the World wing to add or turn on a lorebook.</span></div>
      )}
      {lore && groups.map((g) => (
        <div key={g.bookName || "_"}>
          {g.bookName && <div className="bkh"><Ic name="lucide:book" size={14} />{g.bookName}</div>}
          {g.hits.map((hit) => {
            const badge = reasonBadge(hit, lore.chains);
            const roll = rollBadge(hit);
            return (
              <button type="button" key={`${hit.bookId}:${hit.entryId}`} className="he" style={{ "--c": badge.tone } as CSSProperties}>
                <Ic name={badge.icon} size={16} />
                <div>
                  <b>{hit.title}</b>
                  <span className="rs">{badge.text}</span>
                  {roll && <span className="rs">{roll.text}</span>}
                  <div className="tags"><span>{hit.place}</span>{hit.loop > 0 && <span>loop {hit.loop}</span>}</div>
                </div>
                <span className="tk">~{hit.tokens}</span>
              </button>
            );
          })}
        </div>
      ))}
      {recall && (
        <div>
          <div className="bkh"><Ic name="lucide:book" size={14} />Recalled by the Compendium{recall.cached ? " (kept from the last reply)" : ""}</div>
          {recall.injected.map((hit) => (
            <button type="button" key={`${hit.bookId}:${hit.entryId}`} className="he" style={{ "--c": "var(--deck-lorebook)" } as CSSProperties}>
              <Ic name="lucide:book" size={16} />
              <div>
                <b>{hit.title}</b>
                <span className="rs">{hit.reason || "Picked by the Compendium"}</span>
                <div className="tags"><span>{hit.bookName}</span></div>
              </div>
              <span className="tk">~{hit.tokens}</span>
            </button>
          ))}
          {recall.injected.length === 0 && <div className="hare-none">{recall.status === "failed" ? `Recall failed: ${recall.reason ?? "no reason given"}` : recall.status === "skipped" ? `Recall skipped: ${recall.reason ?? "nothing to read"}` : "Recall picked nothing for this reply."}</div>}
          {recall.cut.length > 0 && <div className="hare-none">Left out for space: {recall.cut.map((h) => h.title).join(", ")}</div>}
        </div>
      )}
      {lore && showMisses && misses.length > 0 && (
        <div className="hare-miss">
          <button type="button" className="mh" onClick={() => setMissesOpen((v) => !v)}>
            <span>Didn&apos;t fire ({misses.length})</span><span>{missesOpen ? "hide" : "show"}</span>
          </button>
          {missesOpen && misses.map((m) => <div className="mi" key={`${m.bookId}:${m.entryId}`}><span>{m.title}</span><em>{m.why}</em></div>)}
        </div>
      )}
    </>
  );
}
