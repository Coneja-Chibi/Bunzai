/**
 * TrackHare's popover (wireframe states `panel`/`miss`): what fired on a reply, grouped and sorted,
 * with the Didn't-fire section and the footer to Tokens/Chains/Earlier replies. Presentational: all
 * grouping, sorting, and badge text come from hare-core.ts; this file only renders what it is given.
 * "Earlier replies" is not drawn in the approved wireframe (no state for it); this is the minimal
 * list the plan's Behavior section asks for.
 */
import { useState, type JSX, type RefObject } from "react";
import { Ic } from "../../../../_shared/ic";
import type { AsyncState } from "../../../../_shared/async-state";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { HareLogo } from "./hare-logo";
import { PopoutButton } from "../../popout/popout-panel";
import { badgeCount, type Density, type SortMode } from "./hare-core";
import { HareHits } from "./hare-hits";

export type TraceState = AsyncState<{ trace: SceneTrace | null }>;

export function HarePopover({ panelRef, traceState, density, group, sort, showMisses, pop, onToggleDensity, onPickReply, onOpenTokens, onOpenChains, onClose }: {
  panelRef: RefObject<HTMLDivElement | null>;
  traceState: TraceState;
  density: Density;
  group: boolean;
  sort: SortMode;
  showMisses: boolean;
  /** The lore trace's pop-out: the button that floats it. */
  pop?: { id: string; open(): void };
  onToggleDensity(d: Density): void;
  onPickReply(messageId: string): void;
  onOpenTokens(): void;
  onOpenChains(): void;
  onClose(): void;
}): JSX.Element {
  const [repliesOpen, setRepliesOpen] = useState(false);

  const trace = traceState.state === "ready" ? traceState.trace : null;
  const lore = trace?.lore ?? null;

  return (
    <div className={`hare-pop${density === "compact" ? " compact" : ""}`} ref={panelRef} tabIndex={-1} role="dialog" aria-modal="false" aria-label="TrackHare" data-part="props.trackhare">
      <div className="hp-hd">
        <HareLogo size={16} />
        <b>TrackHare</b>
        {trace && <span className="cnt">{badgeCount(trace)}</span>}
        <span className="grow" />
        <span className="seg2">
          <button type="button" className={density === "detailed" ? "on" : undefined} onClick={() => onToggleDensity("detailed")}>Detailed</button>
          <button type="button" className={density === "compact" ? "on" : undefined} onClick={() => onToggleDensity("compact")}>Compact</button>
        </span>
        {pop && <PopoutButton id={pop.id} onClick={pop.open} />}
        <button type="button" className="close" aria-label="Close" onClick={onClose}><Ic name="lucide:x" size={14} /></button>
      </div>

      {traceState.state === "loading" && <div className="hare-none">Loading...</div>}
      {traceState.state === "failed" && <div className="hare-err">{traceState.why}</div>}
      {traceState.state === "ready" && trace === null && <div className="hare-none">No reply yet.</div>}

      {trace && (
        <>
          <HareHits trace={trace} group={group} sort={sort} showMisses={showMisses} />
          <div className="hp-ft">
            <button type="button" className="hbtn pri" onClick={onOpenTokens} disabled={!trace}><Ic name="lucide:chart-pie" size={14} />Tokens</button>
            <button type="button" className="hbtn" onClick={onOpenChains} disabled={!lore}><Ic name="lucide:link" size={14} />Chains</button>
            <button type="button" className="hbtn" onClick={() => setRepliesOpen((v) => !v)} disabled={trace.replies.length === 0}>
              <Ic name="lucide:arrow-left" size={14} />Earlier replies
            </button>
          </div>
          {repliesOpen && (
            <div className="hare-replies">
              {trace.replies.map((r) => (
                <button type="button" key={r.messageId} onClick={() => { setRepliesOpen(false); onPickReply(r.messageId); }}>Reply #{r.number}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
