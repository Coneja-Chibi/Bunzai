/**
 * What a Standardize run shows besides its banner (RoleCall `BentoDashboard.tsx:1221-1448` and `StandardizeProgressDrawer :2181-2335`):
 * the progress drawer with CANCEL and the live log, the Complete card, the Revert Complete and Revert Failed cards, the Error card,
 * and the lock notice that pauses edits while a run works. Copy is RoleCall's, with "retired" where it says "deleted" (nothing is
 * deleted) and no `Clear Lock` (the lock lives only as long as the run does). Presentational: the hook owns the state.
 */
import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { isActive, type RevertResult, type RunLine, type RunSnapshot } from "../../../../../core/compendium";
import { Button } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { GLYPH, titled } from "../compendium-core";

/** RoleCall's lock banner (`CompendiumWingPanel.tsx:1229-1234`). */
export const LOCK_TEXT = "Standardization in progress. Edits are paused to avoid clobbering work in flight";

export const LockNotice = (): JSX.Element => <div className="cp-lock" role="status" data-part="compendium.lock"><Ic name="lucide:lock" size={12} /><span>{LOCK_TEXT}</span></div>;

const clock = (at: number): string => new Date(at).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Log({ lines, scroll }: { lines: readonly RunLine[]; scroll?: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines.length, scroll]);
  return (
    <div className="log" ref={ref}>
      {lines.map((l, i) => <div key={i} className={l.level}><span>{clock(l.at)}</span>{l.text}</div>)}
    </div>
  );
}

export function Drawer({ run, onCancel }: { run: RunSnapshot; onCancel(): void }): JSX.Element {
  const pct = run.total > 0 ? Math.min(100, Math.round((run.processed / run.total) * 100)) : 0;
  const stopping = run.status === "cancelling";
  return (
    <div className="cp-std-card run" data-part="compendium.standardize.running">
      <div className="hd">
        <div>
          <div className="kick">{GLYPH.diamond} Standardization Running</div>
          <div className="phase">{stopping ? "Stopping after the entries already being written..." : `Batch ${Math.min(run.batches.done + 1, run.batches.total)}/${run.batches.total}`}</div>
          {run.current && <div className="cur">Currently processing: {run.current}</div>}
        </div>
        <Button variant="danger" size="sm" disabled={stopping} onClick={onCancel}>{stopping ? "STOPPING..." : "CANCEL"}</Button>
      </div>
      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="stats">
        <span>{run.processed} / {run.total}</span>
        <span className="ok">OK {run.rewritten}</span>
        {run.consumed > 0 && <span className="info">CONSUMED {run.consumed}</span>}
        {run.created > 0 && <span className="warn">NEW {run.created}</span>}
        {run.dedup > 0 && <span className="info">DEDUP {run.dedup}</span>}
        <span className={run.failed > 0 ? "bad" : ""}>FAIL {run.failed}</span>
      </div>
      {run.log.length > 0 && <div className="logw"><div className="lh">Live Log ({run.log.length})</div><Log lines={run.log} scroll /></div>}
    </div>
  );
}

function Details({ summary, children }: { summary: string; children: ReactNode }): JSX.Element {
  return <details className="more"><summary>{summary}</summary>{children}</details>;
}

/** The finished run: Complete, or Stopped when Cancel ended it. */
export function Finished({ run, reverting, canRevert, onDismiss, onRevert }: { run: RunSnapshot; reverting: boolean; canRevert: boolean; onDismiss(): void; onRevert(): void }): JSX.Element {
  const stopped = run.status === "cancelled";
  const types = Object.entries(run.typed).sort((a, b) => b[1] - a[1]);
  return (
    <div className={`cp-std-card ${stopped ? "stopped" : "done"}`} data-part={stopped ? "compendium.standardize.stopped" : "compendium.standardize.complete"}>
      <div className="hd">
        <div>
          <div className="kick">{stopped ? `${GLYPH.diamond} Standardization Stopped` : `${GLYPH.check} Standardization Complete`}</div>
          <div className="line">
            {run.rewritten} rewritten {GLYPH.dot} {run.consumed} consumed {GLYPH.dot} {run.created} new (dedup: {run.dedup}) {GLYPH.dot} <span className={run.failed > 0 ? "bad" : "mute"}>{run.failed} failed</span>
          </div>
          {types.length > 0 && <div className="types">{types.map(([t, n]) => <span key={t}><b>{n}</b> {titled(t)}</span>)}</div>}
          {stopped && <div className="sub">Stopped before every entry was reached. Everything written is receipted; run it again to continue with the entries still classic ({run.total - run.processed} not reached).</div>}
          {run.warnings.length > 0 && (
            <Details summary={`${run.warnings.length} warning${run.warnings.length === 1 ? "" : "s"} (click to expand)`}>
              <div className="log">{run.warnings.map((w, i) => <div key={i}>{w}</div>)}</div>
            </Details>
          )}
        </div>
        <div className="side">
          <Button variant="quiet" size="sm" onClick={onDismiss}>DISMISS</Button>
          {canRevert && <Button variant="danger" size="sm" disabled={reverting} onClick={onRevert}>{reverting ? "REVERTING..." : `${GLYPH.revert} REVERT RUN`}</Button>}
        </div>
      </div>
    </div>
  );
}

export function RevertDone({ result, onDismiss }: { result: RevertResult; onDismiss(): void }): JSX.Element {
  return (
    <div className="cp-std-card reverted" data-part="compendium.standardize.reverted">
      <div className="hd">
        <div>
          <div className="kick">{GLYPH.revert} Revert Complete</div>
          <div className="line">
            {result.rewrites} rewrites restored {GLYPH.dot} {result.splits} splits retired {GLYPH.dot} {result.consumed} consumed restored{result.merges > 0 ? ` ${GLYPH.dot} ${result.merges} merges undone` : ""}
          </div>
          <div className="sub">
            {result.skipped.length === 0
              ? "All affected rows are back to their original classic state. You can re-run standardization now."
              : "These were changed since the run, so they were left as they are. Revert again after changing them back."}
          </div>
          {result.skipped.length > 0 && <div className="log">{result.skipped.map((s, i) => <div key={i}>{s}</div>)}</div>}
        </div>
        <Button variant="quiet" size="sm" onClick={onDismiss}>DISMISS</Button>
      </div>
    </div>
  );
}

export function Problem({ title, text, log, onDismiss }: { title: string; text: string; log?: readonly RunLine[]; onDismiss(): void }): JSX.Element {
  return (
    <div className="cp-std-card bad" data-part="compendium.standardize.error">
      <div className="hd">
        <div>
          <div className="kick">{GLYPH.cross} {title}</div>
          <div className="line">{text}</div>
          {log && log.length > 0 && <Details summary={`Live log (${log.length} lines), click to expand`}><Log lines={log} /></Details>}
        </div>
        <Button variant="quiet" size="sm" onClick={onDismiss}>DISMISS</Button>
      </div>
    </div>
  );
}

/** A run that has ended and is not a clean finish: failed with nothing converted. */
export const failedRun = (run: RunSnapshot): boolean => run.status === "failed" && !isActive(run);
