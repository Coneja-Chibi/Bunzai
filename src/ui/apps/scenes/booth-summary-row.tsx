/**
 * The Control Booth's Chat Summary row (rc-parity 08, follow-up 2; RoleCall's Booth has no such row, its summary lives only in Memory): when summaries run and what reaches the AI, with the two
 * switches a person reaches for at the table, Automatic summaries and Include in AI context. It composes the Context wing's own modules: the one read and writer (context/use-summary.ts) and the
 * couplings and words the Memory tab uses, so a switch here writes exactly what the same switch there writes. The text, the method and Backfill history stay in Memory (Open Memory).
 */
import type { CSSProperties, JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import { autoPatch } from "../../../core/summary/couplings";
import { automationActive, resolveSummary } from "../../../core/summary/settings";
import { Ic } from "../../_shared/ic";
import { contextLabel, timingLabel } from "./context/memory-core";
import { useSummary } from "./context/use-summary";
import { Button, Toggle } from "../../components/button";

const TONE = { "--tone": "var(--stage-ok)" } as CSSProperties;

export function BoothSummaryRow({ ctx, chat, onOpen }: { ctx: AppContext; chat: Chat; onOpen(): void }): JSX.Element {
  const view = useSummary(ctx, chat);
  const head = <h3>Chat Summary</h3>;
  if (view.load.state !== "ready") {
    return <section className="bth-sec" data-part="scene.booth.summary">{head}{view.load.state === "failed" ? <p className="bth-note warn" role="alert">{view.load.why}</p> : <p className="bth-note" role="status">Loading the summary...</p>}</section>;
  }
  const s = view.load.s;
  const r = resolveSummary(s.settings);
  const active = automationActive(r);
  const error = view.runError ?? s.error;
  return (
    <section className="bth-sec" data-part="scene.booth.summary">
      {head}
      <div className="bth-map two" data-part="scene.booth.summary.tiles">
        <div><small>Runs</small><b>{timingLabel(r)}</b></div>
        <div><small>AI Context</small><b>{contextLabel(r)}</b></div>
      </div>
      <div className="prop-row" style={TONE}>
        <span className="prop-ic"><Ic name="lucide:sparkles" size={20} /></span>
        <div><b>Automatic summaries</b><small>{active ? "A new summary is written on its own." : "Off. Manual edits and Backfill history still work."}</small></div>
        <Toggle size="sm" tone="var(--tone)" on={active} disabled={view.busy} aria-label={`${active ? "Turn off" : "Turn on"} automatic summaries`} onChange={(on) => void view.patch(autoPatch(r, on))} />
      </div>
      <div className="prop-row" style={TONE}>
        <span className="prop-ic"><Ic name="lucide:brain" size={20} /></span>
        <div><b>Include saved summary in AI context</b><small>The AI receives the saved summary with each reply.</small></div>
        <Toggle size="sm" tone="var(--tone)" on={r.include} disabled={view.busy} aria-label={`${r.include ? "Turn off" : "Turn on"} the saved summary in AI context`} onChange={(include) => void view.patch({ include })} />
      </div>
      {error ? <p className="bth-note warn" role="alert">Last summary run failed: {error}</p> : null}
      <Button variant="quiet" size="sm" onClick={onOpen}>Open Memory</Button>
    </section>
  );
}
