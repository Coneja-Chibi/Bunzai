/**
 * The Final Cut activity dialog (RoleCall's PostProdActivityBadge dialog, PostProdActivityBadge.tsx:196-520): what the passes did to
 * one saved reply. The overall result, then a Changelog tab (each pass: status, time, model, changelog, warnings, rule review, the raw
 * reply behind a disclosure) and a Before / After tab (a word diff of the original against the saved text, with Undo). A re-run is a
 * preview and writes nothing until Apply; Apply and Undo both go through `onApply`, the scene's edit route, so the text they replace
 * stays in Edit history.
 */
import { useEffect, useState, type JSX } from "react";
import { plural } from "../../../../core/text";
import { buildWordDiff } from "../../../../core/final-cut/diff";
import { PASS_TYPE_LABEL, STATUS_DESCRIPTION, STATUS_LABEL, effectiveStatus, formatDuration, readTrace, summaryTitle, type FinalCutTrace } from "../../../../core/final-cut/trace";
import type { ScenesApi } from "../../../app-contract-scenes";
import { toErrorMessage } from "../../../_shared/error-message";
import { Ic } from "../../../_shared/ic";
import { Button, IconButton, Tabs } from "../../../components/button";
import { InkDialog } from "../../../components/ink-dialog";

type Tab = "changelog" | "diff";
type Loaded = { text: string; trace: FinalCutTrace | null };
type Preview = { before: string; after: string; rerunId: string };

function Diff({ before, after, className }: { before: string; after: string; className: string }): JSX.Element {
  return (
    <pre className={className}>
      {buildWordDiff(before, after).map((s, i) => (s.type === "added" ? <ins key={i}>{s.text}</ins> : s.type === "removed" ? <del key={i}>{s.text}</del> : <span key={i}>{s.text}</span>))}
    </pre>
  );
}

export function FinalCutActivity({ api, chatId, messageId, enabled, onApply, onApplyRerun, onClose }: {
  api: Pick<ScenesApi, "getFinalCutRun" | "rerunFinalCut">;
  chatId: string;
  messageId: string;
  /** How many passes a re-run would run. */
  enabled: number;
  /** Writes the text over the shown version as an edit; rejects when it could not. */
  onApply(text: string): Promise<void>;
  /** Applies a previewed re-run by its id (the server applies what it ran). */
  onApplyRerun(rerunId: string): Promise<void>;
  onClose(): void;
}): JSX.Element {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<Tab>("changelog");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState<"rerun" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.getFinalCutRun(chatId, messageId).then(
      (r) => alive && setLoaded({ text: r.text, trace: readTrace(r.run) }),
      (e) => { if (alive) { setLoaded({ text: "", trace: null }); setError(toErrorMessage(e, "The run could not be read.")); } },
    );
    return () => { alive = false; };
  }, [api, chatId, messageId]);

  const rerun = async (): Promise<void> => {
    if (!loaded) return;
    setWorking("rerun");
    setError(null);
    try {
      const out = await api.rerunFinalCut(chatId, messageId);
      setPreview({ before: loaded.text, after: out.text, rerunId: out.rerunId });
    } catch (e) {
      setError(toErrorMessage(e, "The passes could not be rerun."));
    } finally {
      setWorking(null);
    }
  };
  const apply = async (text: string | { rerunId: string }): Promise<void> => {
    setWorking("apply");
    setError(null);
    try {
      await (typeof text === "string" ? onApply(text) : onApplyRerun(text.rerunId));
      onClose();
    } catch (e) {
      setError(toErrorMessage(e, "The reply could not be changed."));
      setWorking(null);
    }
  };
  const trace = loaded?.trace ?? null;
  const busy = working !== null;
  return (
    <InkDialog onDismiss={onClose} ariaLabel="Final Cut Activity" sheetClassName="cx-sheet">
      <div className="cx" data-part="scene.finalcut.activity">
        <header className="cx-top"><h2>Final Cut Activity</h2><IconButton variant="quiet" size="sm" label="Close Final Cut activity" icon="lucide:x" onClick={onClose} /></header>
        <div className="cx-body">
          {error && <p className="cx-err" role="alert">{error}</p>}
          {loaded === null ? <p className="cx-note" role="status">Loading...</p> : !trace ? <p className="cx-note">This reply has no saved Final Cut run.</p> : (
            <>
              <p className="cx-blurb">{summaryTitle(trace)}{formatDuration(trace.ms) ? ` (${formatDuration(trace.ms)})` : ""}{trace.stopped ? ` - stopped (${trace.stopped === "cancelled" ? "cancelled" : "timed out"}); the text kept is what the finished passes left` : ""}</p>
              <Tabs label="Final Cut activity" value={tab} onChange={setTab} items={[{ value: "changelog", label: "Changelog" }, { value: "diff", label: "Before / After" }]} />
              {tab === "changelog" ? (
                <ul className="fa-passes">
                  {trace.passes.map((p) => {
                    const status = effectiveStatus(p);
                    return (
                      <li key={p.id} className={`fa-pass ${status}`}>
                        <div className="fa-head"><b>{p.label ?? PASS_TYPE_LABEL[p.type]}</b><span title={STATUS_DESCRIPTION[status]}>{STATUS_LABEL[status]}</span>{formatDuration(p.ms) && <span>{formatDuration(p.ms)}</span>}{p.model && <span>{p.model}</span>}</div>
                        {p.changelog.map((c, i) => <p key={i} className="fa-line"><b>{c.rule}</b> {c.description}</p>)}
                        {p.warnings.map((w, i) => <p key={i} className="fa-warn">{w}</p>)}
                        {p.ruleReview && p.ruleReview.length > 0 && (
                          <ul className="fa-review">{p.ruleReview.map((r, i) => <li key={i}><b>{r.rule}</b> <em>{r.verdict}</em> {r.reasoning}</li>)}</ul>
                        )}
                        {p.raw !== undefined && <details><summary>Raw model reply</summary><pre>{p.raw}</pre></details>}
                      </li>
                    );
                  })}
                </ul>
              ) : trace.original === undefined ? <p className="cx-note">The passes left this reply unchanged.</p> : (
                <>
                  <Diff before={trace.original} after={loaded.text} className="fa-diff" />
                  {trace.original !== loaded.text && <div className="cx-acts"><Button disabled={busy} onClick={() => void apply(trace.original!)}>Undo</Button></div>}
                </>
              )}
              {tab === "changelog" && trace.reruns && trace.reruns.length > 0 && (
                <section className="fa-hist">
                  <h4>Re-runs</h4>
                  <ul>
                    {trace.reruns.map((r, i, all) => (
                      <li key={i}>
                        <details>
                          <summary>Re-run {i + 1}: {plural(r.passes.length, "pass", "passes")}{formatDuration(r.ms) ? `, ${formatDuration(r.ms)}` : ""}</summary>
                          <Diff before={r.before} after={r.after} className="fa-diff" />
                          {i === all.length - 1 && loaded.text === r.after && <div className="cx-acts"><Button disabled={busy} onClick={() => void apply(r.before)}>Undo this re-run</Button></div>}
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {preview ? (
                <div className="fa-rerun">
                  <h4>Rerun preview</h4>
                  {preview.before === preview.after ? <p className="cx-note">The rerun changed nothing.</p> : <Diff before={preview.before} after={preview.after} className="fa-diff" />}
                  <div className="cx-acts">
                    <Button variant="quiet" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button>
                    {preview.before !== preview.after && <Button variant="primary" icon="lucide:check" disabled={busy} onClick={() => void apply({ rerunId: preview.rerunId })}>Apply</Button>}
                  </div>
                </div>
              ) : (
                <Button variant="primary" block disabled={busy || enabled === 0} title={enabled === 0 ? "Enable a pass in the Final Cut wing first" : undefined} onClick={() => void rerun()}>
                  {working === "rerun" ? "Rerunning..." : enabled === 0 ? "Rerun enabled passes" : `Rerun ${enabled} enabled ${enabled === 1 ? "pass" : "passes"}`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </InkDialog>
  );
}
