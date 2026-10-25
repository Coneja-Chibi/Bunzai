/**
 * The "Change the setup" sheet (RoleCall's SceneLoadoutSwitcher.tsx): every saved loadout with Apply (at once) and Review
 * changes (the plan first), the one that is active marked by its id (RoleCall matches by name), and Save current setup. A
 * failed or empty apply is said inside the sheet; a finished one closes it and the receipt banner carries the report.
 */
import { useState, type JSX } from "react";
import { plural } from "../../../../core/text";
import type { LoadoutReceipt, LoadoutRecord } from "../../../../studio/loadout-record";
import type { AppContext } from "../../../app-contract";
import { InkDialog } from "../../../components/ink-dialog";
import { LoadoutReview } from "./loadout-review";
import type { LoadoutList } from "./use-scene-loadouts";

export function LoadoutSwitcher({ ctx, chatId, list, active, busy, onApply, onSaveCurrent, onRetry, onClose }: {
  ctx: AppContext;
  chatId: string;
  list: LoadoutList;
  /** The latest open receipt, if any: its loadout is the active one. */
  active: LoadoutReceipt | null;
  busy: boolean;
  /** Applies a loadout; answers what to say in the sheet, or null when it is done and the sheet may close. */
  onApply(loadout: LoadoutRecord): Promise<string | null>;
  onSaveCurrent(): void;
  onRetry(): void;
  onClose(): void;
}): JSX.Element {
  const [applying, setApplying] = useState<string | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const [review, setReview] = useState<LoadoutRecord | null>(null);
  const run = async (loadout: LoadoutRecord): Promise<void> => {
    if (applying) return;
    setApplying(loadout.id);
    setSay(null);
    const said = await onApply(loadout);
    setApplying(null);
    if (said === null) onClose();
    else { setSay(said); setReview(null); }
  };
  const activeCount = active?.rows.filter((r) => r.state === "applied" || r.state === "pending").reduce((n, r) => n + r.panels.length, 0) ?? 0;
  return (
    <>
      <InkDialog ariaLabel="Scene loadouts" onDismiss={() => { if (!applying) onClose(); }} sheetClassName="ldd-sheet">
        <div className="ldd">
          <header>
            <div>
              <div className="ldd-lbl">Scene loadout</div>
              <h2>Change the setup</h2>
              <p className="ldd-note">Apply a saved setup to this scene, or review its changes first. Messages and takes stay untouched.</p>
              {active && <p className="ldd-active">Active · {active.loadoutName} · {plural(activeCount, "setting")} · {active.code}</p>}
            </div>
            <button type="button" className="ldd-x" aria-label="Close loadout switcher" disabled={applying !== null} onClick={onClose}>X</button>
          </header>
          {say && <p className="ldd-err" role="alert">{say}</p>}
          <div className="ldd-list">
            {list.state === "loading" && <p className="ldd-quiet">Loading loadouts...</p>}
            {list.state === "failed" && <p className="ldd-quiet" role="alert">Your loadouts could not be loaded. <button type="button" className="ldd-link" onClick={onRetry}>Try again</button></p>}
            {list.state === "ready" && list.loadouts.length === 0 && <p className="ldd-quiet">No saved loadouts yet. Save this scene's setup to start one.</p>}
            {list.state === "ready" && list.loadouts.map((l) => {
              const on = active?.loadoutId === l.id;
              return (
                <div key={l.id} className={`ldd-item${on ? " on" : ""}`} data-loadout={l.id}>
                  <div className="pn"><b>{l.name}</b><small>{plural(l.panels.length, "setting")}{on ? " · active" : ""}</small></div>
                  <button type="button" className="pri" aria-label={`Apply ${l.name}`} disabled={busy || applying !== null} onClick={() => void run(l)}>{applying === l.id ? "Applying..." : "Apply"}</button>
                  <button type="button" disabled={busy || applying !== null} onClick={() => { setSay(null); setReview(l); }}>Review changes</button>
                </div>
              );
            })}
          </div>
          <footer><button type="button" className="pri" disabled={applying !== null} onClick={onSaveCurrent}>Save current setup</button></footer>
        </div>
      </InkDialog>
      {review && <LoadoutReview ctx={ctx} chatId={chatId} loadout={review} applying={applying !== null} onCancel={() => setReview(null)} onApply={() => void run(review)} />}
    </>
  );
}
