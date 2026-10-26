/**
 * What fired on a reply, shared by TrackHare's popover and its pop-out: the reply line, the lore entries grouped and sorted, the
 * entries the Compendium recalled, and the Didn't-fire section. Presentational: grouping and sorting come from hare-core.ts.
 */
import { useState, type JSX } from "react";
import { Disclosure, ListRow } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { bookGroups, reasonBadge, rollBadge, sortHits, type SortMode } from "./hare-core";
import { VirtualRows } from "../../../../_shared/virtual-list";

const HIT_ROW_PX = 52;
const MISS_ROW_PX = 28;
const hitKey = (h: { bookId: string; entryId: string }): string => `${h.bookId}:${h.entryId}`;

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
      {lore && groups.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (g) => (
        <div key={g.bookName || "_"}>
          {g.bookName && <div className="bkh"><Ic name="lucide:book" size={14} />{g.bookName}</div>}
          <VirtualRows items={g.hits} keyOf={hitKey} estimate={HIT_ROW_PX} render={(hit) => {
            const badge = reasonBadge(hit, lore.chains);
            const roll = rollBadge(hit);
            return (
              <ListRow data-part="props.trackhare.hit" vars={{ "--c": badge.tone }}
                leading={<Ic name={badge.icon} size={16} className="he-ic" />} label={hit.title}
                subtitle={<><span className="rs">{badge.text}</span>{roll && <span className="rs">{roll.text}</span>}<span className="tags"><span>{hit.place}</span>{hit.loop > 0 && <span>loop {hit.loop}</span>}</span></>}
                meta={<span className="tk">~{hit.tokens}</span>} />
            );
          }} />
        </div>
      ))}
      {recall && (
        <div>
          <div className="bkh"><Ic name="lucide:book" size={14} />Recalled by the Compendium{recall.cached ? " (kept from the last reply)" : ""}</div>
          <VirtualRows items={recall.injected} keyOf={hitKey} estimate={HIT_ROW_PX} render={(hit) => (
            <ListRow data-part="props.trackhare.hit" vars={{ "--c": "var(--deck-lorebook)" }}
              leading={<Ic name="lucide:book" size={16} className="he-ic" />} label={hit.title}
              subtitle={<><span className="rs">{hit.reason || "Picked by the Compendium"}</span><span className="tags"><span>{hit.bookName}</span></span></>}
              meta={<span className="tk">~{hit.tokens}</span>} />
          )} />
          {recall.injected.length === 0 && <div className="hare-none">{recall.status === "failed" ? `Recall failed: ${recall.reason ?? "no reason given"}` : recall.status === "skipped" ? `Recall skipped: ${recall.reason ?? "nothing to read"}` : "Recall picked nothing for this reply."}</div>}
          {recall.cut.length > 0 && <div className="hare-none">Left out for space: {recall.cut.map((h) => h.title).join(", ")}</div>}
        </div>
      )}
      {lore && showMisses && misses.length > 0 && (
        <div className="hare-miss">
          <Disclosure variant="line" open={missesOpen} onClick={() => setMissesOpen((v) => !v)} label={`Didn't fire (${misses.length})`} summary={missesOpen ? "hide" : "show"} />
          {missesOpen && <VirtualRows items={misses} keyOf={hitKey} estimate={MISS_ROW_PX} render={(m) => <div className="mi"><span>{m.title}</span><em>{m.why}</em></div>} />}
        </div>
      )}
    </>
  );
}
