/**
 * The receipt banner (RoleCall's LoadoutReceiptBanner.tsx): the latest apply on this scene while its 15 minutes are open, with
 * an Undo. It is drawn from the receipt alone, so it reads the same after leaving the scene and coming back. A part-way apply
 * says which settings applied and which did not; an apply that wrote nothing has no Undo.
 */
import type { JSX } from "react";
import type { LoadoutReceipt } from "../../../../studio/loadout-record";
import { Button } from "../../../components/button";
import { bannerView } from "./loadout-text";

export function LoadoutBanner({ receipt, now, working, busy, onUndo }: { receipt: LoadoutReceipt; now: number; working: boolean; busy: boolean; onUndo(): void }): JSX.Element {
  const v = bannerView(receipt, now);
  return (
    <div className={`ldb-banner ${v.tone}`} role="status" data-part="scene.booth.loadouts.banner">
      <div className="pn">
        <b>{v.headline}</b><span>{v.detail}</span>
        {v.lines.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (line) => <p key={line}>{line}</p>)}
      </div>
      {v.undoable && <Button size="sm" disabled={working || busy} onClick={onUndo}>Undo apply</Button>}
    </div>
  );
}
