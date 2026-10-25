/**
 * RECONCILE RECENT SCENE (RoleCall ReconcileRecentCard, ParticipantRegistryPanel.tsx:198-248): a slider for how many recent messages and
 * RECONCILE, one model-charged check that never scans history automatically. RoleCall stores what the model found at once; here the
 * names it found are listed first and only the ones the person ticks are added, as one run that Undo takes back. No Cancel yet: a check
 * runs to its end or fails.
 */
import { useEffect, useState, type JSX } from "react";
import { Slider } from "../../../components/slider";
import { RECONCILE_DEFAULT_MESSAGES, RECONCILE_MAX_MESSAGES } from "../../../../core/participants/reconcile";
import type { Reconcile } from "../participants/use-scene-participants";

export function ReconcileCard({ available, state, onRun, onConfirm, onUndo, onDismiss }: {
  available: number; state: Reconcile; onRun(count: number): void; onConfirm(names: string[]): void; onUndo(run: string): void; onDismiss(): void;
}): JSX.Element {
  const max = Math.max(1, Math.min(RECONCILE_MAX_MESSAGES, available || 1));
  const [count, setCount] = useState(() => Math.min(RECONCILE_DEFAULT_MESSAGES, max));
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setCount((c) => Math.min(c, max)), [max]);
  useEffect(() => { if (state.state === "proposed") setPicked(state.proposal.candidates.map((c) => c.name)); }, [state]);
  const running = state.state === "running";
  const counts = (known: number, rejected: number): string => `${known ? ` · ${known} already known` : ""}${rejected ? ` · ${rejected} skipped` : ""}`;
  return (
    <section className="recon" data-part="scene.cast.reconcile">
      <div className="top">
        <div>
          <h3>Reconcile recent scene</h3>
          <p>A one-time, model-charged check of selected recent messages. It never scans history automatically.</p>
        </div>
        <div className="ctl">
          <Slider id="participant-reconcile-range" readout={false} aria-label="Messages to reconcile" min={1} max={max} value={count} disabled={running} onChange={setCount} />
          <output>{count}</output>
          <button type="button" className="go" disabled={running || state.state === "proposed"} onClick={() => onRun(count)}>{running ? "Reconciling..." : "Reconcile"}</button>
        </div>
      </div>
      {state.state === "failed" && <p className="st" role="alert">{state.why}</p>}
      {state.state === "done" && (
        <p className="st" role="status">{state.added} added · {state.known} already known {state.run && <button type="button" onClick={() => onUndo(state.run!)}>Undo</button>}</p>
      )}
      {state.state === "proposed" && (
        <div className="found">
          {state.proposal.candidates.length === 0
            ? <p className="st" role="status">Nothing new in the last {state.proposal.messages} messages{counts(state.proposal.known, state.proposal.rejected)} <button type="button" onClick={onDismiss}>Dismiss</button></p>
            : <>
              <p className="st" role="status">Found {state.proposal.candidates.length} new in the last {state.proposal.messages} messages{counts(state.proposal.known, state.proposal.rejected)}. Nothing is added until you confirm.</p>
              {state.proposal.candidates.map((c) => (
                <label key={c.name}><input type="checkbox" checked={picked.includes(c.name)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.name] : p.filter((n) => n !== c.name)))} />
                  <span>{c.name}{c.description && <small> {c.description}</small>}</span></label>
              ))}
              <div className="acts"><button type="button" className="go" disabled={picked.length === 0} onClick={() => onConfirm(picked)}>Add selected</button><button type="button" onClick={onDismiss}>Dismiss</button></div>
            </>}
        </div>
      )}
    </section>
  );
}
