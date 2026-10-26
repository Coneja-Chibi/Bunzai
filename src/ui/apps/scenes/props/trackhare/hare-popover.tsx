/**
 * TrackHare's popover (wireframe states `panel`/`miss`): what fired on a reply, grouped and sorted,
 * with the Didn't-fire section and the footer to Tokens/Chains/Earlier replies. Presentational: all
 * grouping, sorting, and badge text come from hare-core.ts; this file only renders what it is given.
 * "Earlier replies" is not drawn in the approved wireframe (no state for it); this is the minimal
 * list the plan's Behavior section asks for.
 */
import { useState, type JSX, type RefObject } from "react";
import { Button, IconButton, MenuItem, Segmented } from "../../../../components/button";
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
        <Segmented size="sm" label="Panel density" items={[{ value: "detailed", label: "Detailed" }, { value: "compact", label: "Compact" }]} value={density} onChange={onToggleDensity} />
        {pop && <PopoutButton id={pop.id} onClick={pop.open} />}
        <IconButton size="sm" label="Close" icon="lucide:x" onClick={onClose} />
      </div>

      {traceState.state === "loading" && <div className="hare-none">Loading...</div>}
      {traceState.state === "failed" && <div className="hare-err">{traceState.why}</div>}
      {traceState.state === "ready" && trace === null && <div className="hare-none">No reply yet.</div>}

      {trace && (
        <>
          <HareHits trace={trace} group={group} sort={sort} showMisses={showMisses} />
          <div className="hp-ft">
            <Button variant="primary" size="sm" icon="lucide:chart-pie" onClick={onOpenTokens} disabled={!trace}>Tokens</Button>
            <Button size="sm" icon="lucide:link" onClick={onOpenChains} disabled={!lore}>Chains</Button>
            <Button size="sm" icon="lucide:arrow-left" onClick={() => setRepliesOpen((v) => !v)} disabled={trace.replies.length === 0}>Earlier replies</Button>
          </div>
          {repliesOpen && (
            <div className="hare-replies">
              {trace.replies.map((r) => (
                <MenuItem key={r.messageId} onClick={() => { setRepliesOpen(false); onPickReply(r.messageId); }}>Reply #{r.number}</MenuItem>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
