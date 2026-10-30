/**
 * One opened call of This turn (RoleCall `OutboundCallsPanel.tsx` `renderDetail`/`renderMessages`): the Request / Raw JSON tabs of the reply, with
 * long blocks folded until opened and a Copy request button, the Tools tab for the reply's tool rounds, and the recall's result. Presentational:
 * every number comes from the trace, and a reply whose text was not kept says so and shows sizes only.
 */
import { useState, type JSX } from "react";
import { Button, Disclosure, Tabs } from "../../../components/button";
import { copyText } from "../../../_shared/clipboard";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import type { SceneTrace } from "../../../app-contract-scenes";
import { formatDuration, lanesOf, rawJson, requestBlocks, routeRows, type CallRow } from "./this-turn-core";
import { VirtualRows } from "../../../_shared/virtual-list";

type Tab = "request" | "tools" | "route" | "time" | "raw";
const KEPT = "Raw text is kept for each take's latest reply; this one shows sizes only.";

function Request({ trace }: { trace: SceneTrace }): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const blocks = requestBlocks(trace);
  const flip = (i: number): void => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div className="tt-msgs">
      {!trace.rawAvailable && <p className="tt-note">{KEPT}</p>}
      {blocks.map((b, i) => {
        const shown = !b.long || open.has(i);
        return (
          <div className="tt-msg" key={i}>
            <Disclosure open={shown} onClick={() => b.long && flip(i)}
              label={<span className={`tt-role ${b.role}`}>{b.role} <i>{b.label}</i></span>}
              summary={<span className="tt-tk">~{b.tokens.toLocaleString()} tokens{b.long ? (shown ? " · fold" : " · open") : ""}</span>} />
            {b.text !== undefined && <pre className={shown ? "" : "folded"}>{b.text || " "}</pre>}
          </div>
        );
      })}
    </div>
  );
}

function Tools({ tools }: { tools: NonNullable<SceneTrace["tools"]> }): JSX.Element {
  return (
    <div className="tt-msgs">
      <p className="tt-note">{tools.rounds} of {tools.maxRounds} tool rounds used.</p>
      {tools.calls.map((c, i) => (
        <div className="tt-msg" key={i}>
          <div className="tt-tool"><span className="tt-role system">round {c.round} <i>{c.name}</i></span><span className="tt-tk">{c.ok ? "Done" : "Failed"} · {c.ms} ms · {c.tokens.toLocaleString()} tokens</span></div>
          <pre>{c.args || " "}</pre>
          {c.error && <p className="tt-fail">{c.error}</p>}
          {c.entries.length > 0 && <p className="tt-note">{c.entries.map((e) => `${e.title} (${e.tokens})`).join(", ")}</p>}
        </div>
      ))}
    </div>
  );
}

function Route({ route }: { route: NonNullable<SceneTrace["route"]> }): JSX.Element {
  const { attempts, fellBack } = routeRows(route);
  return (
    <div className="tt-msgs">
      {attempts.map(/* bounded-ok: per-turn bounded detail lines */ (a) => (
        <div className={`tt-msg tt-attempt ${a.outcome.toLowerCase()}`} key={a.number}>
          <div className="tt-tool"><span className="tt-role system">Attempt {a.number} <i>{a.model}</i></span><span className="tt-tk">{a.outcome}</span></div>
          <p className="tt-note">{a.connectionId} ({a.kind}){a.served ? `, answered by ${a.served}` : ""}</p>
          {a.detail && <p className={a.outcome === "Failed" ? "tt-fail" : "tt-note"}>{a.detail}</p>}
        </div>
      ))}
      {fellBack && <p className="tt-note">The Fallback Model answered after the scene's model failed.</p>}
    </div>
  );
}

function Time({ trace }: { trace: SceneTrace }): JSX.Element {
  return (
    <div className="tt-msgs">
      {lanesOf(trace).map((l) => (
        <div className="tt-lane" key={l.id}><span>{l.label}</span><b>{formatDuration(l.ms)}</b><em><i style={{ width: `${l.percent}%` }} /></em></div>
      ))}
      <p className="tt-note">Each bar is how long each part took, not when it started: the turn keeps lengths, not start times.</p>
    </div>
  );
}

export function CallDetail({ row, trace }: { row: CallRow; trace: SceneTrace }): JSX.Element {
  const [tab, setTab] = useState<Tab>("request");
  const copied = useFlash<boolean>(FLASH_MS.copy);
  if (row.bookPhaseId) {
    const phase = trace.book?.phases.find((p) => p.id === row.bookPhaseId);
    return <div className="tt-detail" data-part="scene.context.promptbook"><p className="tt-note">{phase?.role === "private" ? "Private phase" : "After phase"} · {phase?.why}</p><h4>Request</h4><VirtualRows items={phase?.request ?? []} keyOf={(_text, i) => String(i)} estimate={120} render={(text, i) => <div className="tt-msg"><b>Message {i + 1}</b><pre>{text}</pre></div>} /><h4>Output</h4><pre>{phase?.text ?? "No output was recorded."}</pre></div>;
  }
  if (row.id === "recall") {
    const recall = trace.recall!;
    return (
      <div className="tt-detail">
        {row.state === "Failed" && <p className="tt-fail">{recall.reason || "This call failed. No reason was recorded for it."}</p>}
        <p className="tt-note">{recall.cached ? "Kept from the last reply." : `${recall.calls} model call${recall.calls === 1 ? "" : "s"}.`} {recall.injected.length} placed{recall.cut.length > 0 ? `, ${recall.cut.length} left out for space` : ""}.</p>
        {recall.injected.map(/* bounded-ok: per-turn bounded detail lines */ (h) => <p className="tt-note" key={`${h.bookId}:${h.entryId}`}>{h.title} ({h.tokens} tokens) · {h.bookName}</p>)}
      </div>
    );
  }
  const raw = rawJson(trace);
  const tools = trace.tools && trace.tools.calls.length > 0 ? trace.tools : null;
  const timed = lanesOf(trace).length > 0;
  const tabs: { id: Tab; label: string }[] = [{ id: "request", label: "Request" }, ...(tools ? [{ id: "tools" as const, label: "Tools" }] : []), ...(trace.route ? [{ id: "route" as const, label: "Route" }] : []), ...(timed ? [{ id: "time" as const, label: "Time" }] : []), { id: "raw", label: "Raw JSON" }];
  return (
    <div className="tt-detail">
      <Tabs label="Call detail" value={tab} onChange={setTab} items={tabs.map((t) => ({ value: t.id, label: t.label }))} />
      {tab === "request" && <Request trace={trace} />}
      {tab === "tools" && tools && <Tools tools={tools} />}
      {tab === "route" && trace.route && <Route route={trace.route} />}
      {tab === "time" && <Time trace={trace} />}
      {tab === "raw" && (raw ? <pre className="tt-raw">{raw}</pre> : <p className="tt-note">{KEPT}</p>)}
      {raw && tab !== "tools" && tab !== "route" && tab !== "time" && (
        <div className="tt-copy"><Button size="sm" icon={copied.value ? "lucide:check" : "lucide:copy"} onClick={() => { void copyText(raw).then((ok) => { if (ok) copied.flash(true); }); }}>{copied.value ? "Copied" : "Copy request"}</Button></div>
      )}
    </div>
  );
}
