/**
 * The two time-budget rows (wireframe premiere/scene-pieces.html, section 4): a box in seconds for how long a reply's tools may run and one for how long a prompt build's macros may take. A typed
 * value is kept as a draft and saved when the box is left or Enter is pressed, through the same app-preference writer the other Studio rows use; an empty box or anything that is not a positive
 * number saves nothing and the box goes back to what is saved. The rows are the markup of the settings row primitives (frames/settings-rows.tsx), which are controlled and so would snap a half-typed number back.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../../app-contract";
import { MS_PER_SECOND } from "../../../../../../studio/settings-shape";
import { BUDGETS, msTyped, secondsShown, type BudgetDef } from "./budget-core";

function BudgetRow({ ctx, def }: { ctx: AppContext; def: BudgetDef }): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = secondsShown(ctx.prefs.get(def.key), def.defaultMs);
  const commit = (): void => {
    const ms = draft === null ? null : msTyped(draft);
    setDraft(null);
    if (ms !== null && String(ms / MS_PER_SECOND) !== shown) ctx.prefs.set(def.key, ms);
  };
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.budget">
      <div className="msn-st-t"><b>{def.label}</b><span>{def.description}</span></div>
      <div className="msn-st-c">
        <input className="msn-st-num" type="text" inputMode="decimal" aria-label={`${def.label}, in seconds`} value={draft ?? shown}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
        <span>s</span>
      </div>
    </div>
  );
}

export const BudgetRows = ({ ctx }: { ctx: AppContext }): JSX.Element => <>{BUDGETS.map(/* bounded-ok: the two budgets */ (def) => <BudgetRow key={def.key} ctx={ctx} def={def} />)}</>;
