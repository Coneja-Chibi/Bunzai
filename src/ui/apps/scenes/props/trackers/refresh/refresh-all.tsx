/**
 * "Refresh Enabled Boards" in the Props wing's Legacy Trackers box (RoleCall's full-width accent button, StagecraftExtensions.tsx:1197-1204, QuickPlayPanel.tsx:1477-1488; RoleCall
 * hides it inside the Story Director's drawer, here it sits in the box): the button with "Refreshing {label} (i/n)", a progress bar and Cancel while it runs, and the combined review
 * sheet with each board's own Accept, Accept all, and an Undo on a board that was accepted (the approved wireframe, tracker-refresh/refresh.html).
 */
import type { JSX } from "react";
import { InkDialog } from "../../../../../components/ink-dialog";
import { Ic } from "../../../../../_shared/ic";
import { DiffSections, countOf } from "./refresh-diff";
import { useRefreshAll, type Board, type Entry, type Host, type RefreshAll } from "./use-refresh-all";

function Chips({ e }: { e: Entry }): JSX.Element {
  const d = e.proposal?.diff;
  if (e.status === "ready" && d) {
    return <>{d.added.length > 0 && <span className="rv-chip ok">+{d.added.length} added</span>}{d.changed.length > 0 && <span className="rv-chip warn">~{d.changed.length} changed</span>}
      {d.removed.length > 0 && <span className="rv-chip bad">-{d.removed.length} removed</span>}{(e.proposal?.skipped.length ?? 0) > 0 && <span className="rv-chip warn">{e.proposal!.skipped.length} skipped</span>}</>;
  }
  const word: Partial<Record<Entry["status"], string>> = { same: "No changes", failed: "Failed", dropped: "Dropped", accepted: "Accepted", discarded: "Discarded", undone: "Undone", working: "Reading..." };
  return <span className={`rv-chip${e.status === "accepted" ? " ok" : e.status === "failed" || e.status === "dropped" ? " bad" : ""}`}>{word[e.status]}</span>;
}

function Module({ e, r }: { e: Entry; r: RefreshAll }): JSX.Element {
  const bad = e.status === "failed" || e.status === "dropped";
  return (
    <div className={`mod${bad ? " fail" : ""}${e.status === "accepted" || e.status === "discarded" || e.status === "undone" ? " done" : ""}`} data-part={`props.tracker.review.module.${e.module}`}>
      <div className="mh"><b>{e.label}</b><span className="grow"><Chips e={e} />{e.why && <span>{e.why}</span>}</span>
        {e.status === "ready" && <><button type="button" onClick={() => r.discard(e.module)}>Discard</button><button type="button" className="go" onClick={() => void r.accept(e.module)}>Accept</button></>}
        {e.status === "failed" && <button type="button" onClick={() => void r.retry(e.module)}>Try again</button>}
        {e.status === "accepted" && <button type="button" onClick={() => void r.undo(e.module)}>Undo</button>}</div>
      {e.status === "ready" && e.proposal && <div className="mb"><DiffSections diff={e.proposal.diff} skipped={e.proposal.skipped} /></div>}
    </div>
  );
}

function CombinedSheet({ entries, r }: { entries: Entry[]; r: RefreshAll }): JSX.Element {
  const ready = entries.filter((e) => e.status === "ready");
  const changes = ready.reduce((n, e) => n + (e.proposal ? countOf(e.proposal.diff) : 0), 0);
  return (
    <InkDialog onDismiss={r.close} ariaLabel="Review refresh">
      <div className="scn-sheet accent rv wide" data-part="props.tracker.review">
        <header className="hd"><div className="eb"><Ic name="lucide:refresh-cw" size={16} />Refresh Enabled Boards</div><h2>Refresh Enabled Boards: review</h2>
          <p>{entries.length} {entries.length === 1 ? "board" : "boards"} read from the last 20 messages and the first message. Nothing changes until you accept.</p></header>
        <div className="bd">
          <div className="mods">{entries.map((e) => <Module key={e.module} e={e} r={r} />)}</div>
          <p className="rv-help">Skipped: Storyboards and Tarot. Each Accept can be undone on its own board.</p>
        </div>
        <footer className="ft"><span className="rv-count">{ready.length} {ready.length === 1 ? "board has" : "boards have"} changes ({changes})</span>
          <button type="button" onClick={r.close}>Close</button>
          <button type="button" disabled={ready.length === 0} data-part="props.tracker.review.discard-all" onClick={r.discardAll}>Discard all</button>
          <button type="button" className="go" disabled={ready.length === 0} data-part="props.tracker.review.accept-all" onClick={() => void r.acceptAll()}>Accept all</button></footer>
      </div>
    </InkDialog>
  );
}

export function RefreshAllBox({ host, boards }: { host: Host; boards: readonly Board[] }): JSX.Element {
  const r = useRefreshAll(host, boards);
  const run = r.run;
  const running = run.at === "running";
  return (
    <div className="rall-wrap" data-part="props.trackers.refresh-all">
      <button type="button" className="rall" disabled={running || boards.length === 0} aria-busy={running} onClick={() => void r.start()}>
        <span className={running ? "rf-spin" : ""}><Ic name="lucide:refresh-cw" size={14} /></span>
        <span>{run.at === "running" ? `Refreshing ${run.label} (${run.i}/${run.n})` : "Refresh Enabled Boards"}</span>
      </button>
      {run.at === "running" && (
        <>
          <div className="rall-prog" role="progressbar" aria-valuemin={0} aria-valuemax={run.n} aria-valuenow={run.i - 1} data-part="props.trackers.refresh-all.progress"><i style={{ width: `${((run.i - 1) / run.n) * 100}%` }} /></div>
          <div className="rall-row"><span className="rall-help">One board at a time, so each gets the model's full attention.</span><button type="button" data-part="props.trackers.refresh-all.cancel" onClick={r.cancel}>Cancel</button></div>
        </>
      )}
      {run.at === "idle" && <p className="rall-help">{boards.length === 0 ? "No board is on. Turn one on to refresh it. Storyboards and Tarot are not refreshed." : "Reads the last 20 messages once per enabled board, then shows you every proposal. Nothing changes until you accept."}</p>}
      {run.at === "cancelled" && (
        <div className="rall-note" role="status"><div className="grow">Cancelled after {run.entries.length} of {run.n}.<small>{run.entries.length > 0 ? "The boards already read are waiting in the review." : "No board was read."}</small></div>
          {run.entries.length > 0 && <button type="button" onClick={r.review}>Review {run.entries.length}</button>}<button type="button" onClick={r.close}>Dismiss</button></div>
      )}
      {run.at === "none" && <div className="rall-note" role="status"><div className="grow">Every enabled board already matches the chat.</div><button type="button" onClick={r.close}>Dismiss</button></div>}
      {run.at === "review" && <CombinedSheet entries={run.entries} r={r} />}
    </div>
  );
}
