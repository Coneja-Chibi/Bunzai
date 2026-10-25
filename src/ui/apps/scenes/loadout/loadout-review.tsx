/**
 * The review dialog (RoleCall's LoadoutApplyReviewDialog.tsx): what applying a loadout would change before it does. Three
 * counts from the same plan the apply runs (Will change, Stay as-is, Protected), then each panel that would change and how.
 * The per-panel Replace / Merge / Keep current fold is a later step; defaults apply here.
 */
import { useEffect, useState, type JSX } from "react";
import { PANEL_META, type LoadoutPanelId } from "../../../../core/loadout-panels";
import type { LoadoutRecord } from "../../../../studio/loadout-record";
import type { AppContext } from "../../../app-contract";
import { InkDialog } from "../../../components/ink-dialog";
import { toErrorMessage } from "../../../_shared/error-message";
import { planLoadout, type Plan } from "./loadout-plan";

const HOW = { replace: "Replace", merge: "Merge", "keep-current": "Keep current" } as const;

export function LoadoutReview({ ctx, chatId, loadout, applying, onCancel, onApply }: {
  ctx: AppContext;
  chatId: string;
  loadout: LoadoutRecord;
  applying: boolean;
  onCancel(): void;
  onApply(): void;
}): JSX.Element {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    ctx.api.sceneSettings(chatId).then((live) => { if (current) setPlan(planLoadout(loadout, live)); }, (e: unknown) => { if (current) setWhy(toErrorMessage(e, "this scene's settings could not be read")); });
    return () => { current = false; };
  }, [ctx, chatId, loadout]);
  const count = (...states: string[]): number => plan?.rows.filter((r) => states.includes(r.state)).length ?? 0;
  const metric = (label: string, n: number): JSX.Element => <div data-metric><small>{label}</small><b>{plan ? n : "-"}</b></div>;
  const shown = plan?.rows.filter((r) => r.state === "will-change" || r.state === "failed" || r.state === "unavailable") ?? [];
  return (
    <InkDialog ariaLabel="Review changes" onDismiss={() => { if (!applying) onCancel(); }} sheetClassName="ldd-sheet">
      <div className="ldd">
        <div className="ldd-lbl">Review changes</div>
        <h2>Apply {loadout.name}?</h2>
        <p className="ldd-note">Bunraku can apply this loadout without erasing unrelated settings. Messages, takes, and variables stay untouched.</p>
        <div className="ldr-metrics">{metric("Will change", count("will-change"))}{metric("Stay as-is", count("unchanged"))}{metric("Protected", count("kept-current"))}</div>
        {why && <p className="ldd-err" role="alert">{why}</p>}
        <ul className="ldr-rows">
          {shown.map((r) => (
            <li key={r.panel}><b>{r.label}</b><span>{r.state === "will-change" ? HOW[PANEL_META[r.panel as LoadoutPanelId].strategy] : r.why}</span></li>
          ))}
        </ul>
        <p className="ldd-note">Always protected: messages · takes · variables</p>
        <footer>
          <button type="button" disabled={applying} onClick={onCancel}>Cancel</button>
          <button type="button" className="pri" disabled={applying || !plan} onClick={onApply}>{applying ? "Applying" : "Apply loadout"}</button>
        </footer>
      </div>
    </InkDialog>
  );
}
