/**
 * The pieces of one tracker's refresh the frame draws (the approved wireframe, tracker-refresh/refresh.html; RoleCall's strip button and busy overlay,
 * immersion/index.tsx:445-458 and 638-646): the strip button, the working line with Cancel, the failure or "already matches" line, and the review sheet. The button keeps
 * RoleCall's refresh-cw icon and tooltip and adds the word, because an icon alone hides the feature.
 */
import type { JSX } from "react";
import { InkDialog } from "../../../../../components/ink-dialog";
import { Ic } from "../../../../../_shared/ic";
import { DiffSections, countOf } from "./refresh-diff";
import type { Refresh } from "./use-refresh";

export function RefreshButton({ r, label }: { r: Refresh; label: string }): JSX.Element | null {
  if (!r.enabled) return null;
  const busy = r.phase.at === "working";
  return (
    <button type="button" className={`trk-btn lbl${busy ? " busy" : ""}`} title="Refresh from chat history" aria-label={busy ? `Refreshing ${label}` : "Refresh from chat history"} aria-busy={busy}
      disabled={busy} data-part="props.tracker.refresh" onClick={r.run}>
      <span className={busy ? "rf-spin" : ""}><Ic name="lucide:refresh-cw" size={14} /></span><span>{busy ? "Refreshing" : "Refresh"}</span>
    </button>
  );
}

/** Under the strip: reading (with Cancel), the reason it failed, or that nothing needed to change. */
export function RefreshNotice({ r, label }: { r: Refresh; label: string }): JSX.Element | null {
  const p = r.phase;
  if (p.at === "working") {
    return <div className="trk-status" role="status"><span className="rf-spin"><Ic name="lucide:loader-circle" size={14} /></span><span className="grow">Reading the chat for {label}.</span><button type="button" onClick={r.cancel}>Cancel</button></div>;
  }
  if (p.at === "failed") {
    return <div className="trk-error rf-fail" role="alert"><div className="grow">{p.error}{p.hint && <small>{p.hint}</small>}</div><button type="button" onClick={r.run}>Try again</button><button type="button" onClick={r.dismiss}>Dismiss</button></div>;
  }
  if (p.at === "same" || p.at === "cancelled") {
    return <div className="trk-undo" role="status"><span>{p.at === "same" ? `${label} already matches the chat.` : `Refresh cancelled. ${label} is unchanged.`}</span><button type="button" onClick={r.dismiss}>Dismiss</button></div>;
  }
  return null;
}

/** RoleCall's panel-level busy overlay, kept click-through so the panel stays usable under it. */
export function RefreshOverlay({ r, label }: { r: Refresh; label: string }): JSX.Element | null {
  return r.phase.at === "working"
    ? <div className="rf-overlay" aria-hidden="true"><div><span className="rf-spin"><Ic name="lucide:refresh-cw" size={16} /></span><span>Refreshing {label}...</span></div></div>
    : null;
}

export function RefreshSheet({ r, label }: { r: Refresh; label: string }): JSX.Element | null {
  if (r.phase.at !== "ready") return null;
  const { proposal } = r.phase;
  const count = countOf(proposal.diff);
  return (
    <InkDialog onDismiss={r.dismiss} ariaLabel={`Review ${label} refresh`}>
      <div className="scn-sheet accent rv" data-part="props.tracker.review">
        <header className="hd"><div className="eb"><Ic name="lucide:refresh-cw" size={16} />Refresh from chat history</div><h2>Refresh {label}: review</h2>
          <p>Read from the last 20 messages and the first message. Nothing changes until you accept.</p></header>
        <div className="bd">
          <DiffSections diff={proposal.diff} skipped={proposal.skipped} />
          <p className="rv-help">Matched by name. Entries the chat does not mention are marked removed, and Undo brings them back.</p>
        </div>
        <footer className="ft"><span className="rv-count">{count} {count === 1 ? "change" : "changes"}</span>
          <button type="button" data-part="props.tracker.review.discard" onClick={r.dismiss}>Discard</button>
          <button type="button" data-part="props.tracker.review.retry" onClick={r.run}>Try again</button>
          <button type="button" className="go" autoFocus data-part="props.tracker.review.accept" onClick={r.accept}>Accept</button></footer>
      </div>
    </InkDialog>
  );
}
