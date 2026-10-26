/** TrackHare's options card (wireframe state `settings`): group by book, sort, show Didn't fire, and
 * resetting the button's saved place. Presentational; every toggle saves immediately (hare-stage.tsx
 * owns the prefs write). */
import type { JSX, RefObject } from "react";
import type { SortMode } from "./hare-core";
import { Button, Toggle } from "../../../../components/button";

const SORT_LABEL: Record<SortMode, string> = { placement: "Placement", az: "A to Z", size: "Size" };

export function HareOptions({ panelRef, group, sort, misses, onSetGroup, onSetSort, onSetMisses, onResetPlace }: {
  panelRef: RefObject<HTMLDivElement | null>;
  group: boolean;
  sort: SortMode;
  misses: boolean;
  onSetGroup(v: boolean): void;
  onSetSort(v: SortMode): void;
  onSetMisses(v: boolean): void;
  onResetPlace(): void;
}): JSX.Element {
  return (
    <div className="cfg" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="false" aria-label="TrackHare options">
      <div className="hp-hd"><b>TrackHare options</b></div>
      <div className="r">
        <div>Group by book</div>
        <Toggle size="sm" on={group} aria-label="Group by book" onChange={onSetGroup} />
      </div>
      <div className="r">
        <div>Sort<small>Placement order, A to Z, or size</small></div>
        <select value={sort} aria-label="Sort" onChange={(e) => onSetSort(e.target.value as SortMode)}>
          {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => <option key={m} value={m}>{SORT_LABEL[m]}</option>)}
        </select>
      </div>
      <div className="r">
        <div>Show &quot;Didn&apos;t fire&quot;</div>
        <Toggle size="sm" on={misses} aria-label={'Show "Didn\'t fire"'} onChange={onSetMisses} />
      </div>
      <div className="r">
        <div>Button<small>Drag it anywhere; drag the corner to resize</small></div>
        <Button size="sm" onClick={onResetPlace}>Reset place</Button>
      </div>
    </div>
  );
}
