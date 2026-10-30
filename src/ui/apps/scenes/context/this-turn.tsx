/**
 * This turn, the Prompt Inspector's first sub-tab (RoleCall `OutboundCallsPanel.tsx`): "Earlier turn / Later turn / Refresh" over the reply being read, the
 * Calls / Sent / Received / Turn time tiles, then the calls grouped by when they ran (Before the reply, The reply). Bunzai records no model-call ledger, so
 * it lists exactly what a reply's stored trace holds (this-turn-core.ts) and invents no row: the Compendium's filing and Historian runs happen after a
 * reply and live in the Compendium's Activity. Tokens are Exact (the provider's report) or Estimated (the turn's own estimate), as the legend says.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { Disclosure, IconButton } from "../../../components/button";
import type { SceneTrace } from "../../../app-contract-scenes";
import { dateTimeStamp } from "../scene-meta-core";
import { CallDetail } from "./this-turn-call";
import { callsOf, formatDuration, neighbours, totalsOf, type CallRow } from "./this-turn-core";
import type { TraceState } from "./use-reply-trace";

const GROUPS: { id: CallRow["phase"]; label: string }[] = [{ id: "before", label: "Before the reply" }, { id: "reply", label: "The reply" }, { id: "after", label: "After the reply" }];

const count = (n: number | undefined, estimated: boolean): string => (n === undefined ? "not reported" : `${estimated ? "~" : ""}${n.toLocaleString()}`);

function Row({ row, trace, open, onToggle }: { row: CallRow; trace: SceneTrace; open: boolean; onToggle(): void }): JSX.Element {
  const failed = row.state === "Failed";
  return (
    <li className={`tt-call ${failed ? "failed" : row.confidence}${open ? " open" : ""}`}>
      <Disclosure open={open} onClick={onToggle}
        label={
          <span className="tt-main">
            <span className="tt-top"><b>{row.label}</b>{row.model && <code>{row.model}</code>}<em className={failed ? "bad" : row.state === "Done" ? "ok" : ""}>{row.state}</em></span>
            <span className="tt-trig">{row.trigger}</span>
          </span>
        }
        summary={<span className="tt-num"><b>{formatDuration(row.ms ?? null) || " "}</b>{failed ? "no reply" : `${count(row.sent, row.confidence === "estimated")} sent · ${count(row.back, false)} back`}</span>} />
      {open && <CallDetail row={row} trace={trace} />}
    </li>
  );
}

export function ThisTurn({ state, onPick, onRefresh }: { state: TraceState; onPick(messageId: string): void; onRefresh(): void }): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const trace = state.state === "ready" ? state.trace : null;
  const rows = trace ? callsOf(trace) : [];
  const totals = totalsOf(rows);
  const near = trace ? neighbours(trace) : null;
  return (
    <div className="tt" data-part="scene.context.this-turn">
      <div className="tt-pager">
        <IconButton size="sm" label="Earlier turn" icon="lucide:chevron-left" disabled={!near?.older} onClick={() => near?.older && onPick(near.older)} />
        <div className="tt-pl">{trace ? (near!.latest ? "Latest turn" : "Earlier turn") : "Turn"}{trace?.turn && <span> · {dateTimeStamp(trace.turn.at)}</span>}</div>
        <IconButton size="sm" label="Later turn" icon="lucide:chevron-right" disabled={!near?.newer} onClick={() => near?.newer && onPick(near.newer)} />
        <IconButton size="sm" label="Refresh" icon="lucide:refresh-cw" onClick={onRefresh} />
      </div>
      {trace && (
        <div>
          <div className="tt-tot">
            {([["Calls", totals.calls.toLocaleString()], ["Sent", totals.sent.toLocaleString()], ["Received", totals.back.toLocaleString()], ["Turn time", formatDuration(totals.ms) || "not recorded"]] as const).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
          </div>
          {totals.unreported > 0 && <p className="tt-unrep">{totals.unreported} {totals.unreported === 1 ? "call has" : "calls have"} no token report and {totals.unreported === 1 ? "is" : "are"} not in these totals.</p>}
        </div>
      )}
      {state.state === "loading" ? (
        <div className="tt-load"><Ic name="lucide:loader-circle" size={20} />Loading this turn</div>
      ) : state.state === "failed" ? (
        <div className="tt-err" role="alert">{state.why}</div>
      ) : !trace ? (
        <div className="tt-empty"><Ic name="lucide:clock" size={24} /><p>No recorded calls yet</p><small>Send a message. Every call the turn makes, before, during and after the reply, shows up here.</small></div>
      ) : (
        <div className="tt-groups">
          {GROUPS.map((g) => {
            const here = rows.filter((r) => r.phase === g.id);
            return here.length === 0 ? null : (
              <section key={g.id}>
                <h3 className="tt-grp">{g.label}</h3>
                <ol>{here.map((r) => <Row key={r.id} row={r} trace={trace} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />)}</ol>
              </section>
            );
          })}
          <p className="tt-legend"><span className="ex">Exact tokens</span><span className="es">Estimated tokens</span></p>
        </div>
      )}
    </div>
  );
}
