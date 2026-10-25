/**
 * The Prompt Inspector's review dialog, as RoleCall's ModelCallReviewGate draws it: the title, a token chip, "Before send",
 * the exact request, and the choices. Each message is editable here; Send goes on with the changed ones (RoleCall's
 * "Edit and send"), "Review later" (also Esc, the X, or a click outside) dismisses it and the turn stays paused behind
 * RoleCall's amber "Turn paused for Prompt Inspector" pill (AuthoritativeModelCallReviewOverlay.tsx), which reopens it;
 * "Stop turn" or the scene's Stop ends the turn with nothing kept (rc-parity 03 F16).
 * The request is the one the turn built (studio/scene-turn.ts), shown, never re-formatted. When the reply may call tools, their
 * definitions follow the messages, read-only: they are sent as the request's tool fields, not as text anyone could edit.
 */
import { useEffect, useState, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { InkDialog } from "../../components/ink-dialog";
import { editsOf } from "./inspector-core";
import { OPEN_REVIEW } from "./context/review-open";
import type { RequestParams } from "../../../studio/scene-turn-trace";
import type { Review } from "./use-scene-turn";

const WHY: Record<string, string> = { unsupported: "this provider does not take it", neutral: "it is at its no-op value", "parent-off": "the setting it belongs to is off", unusable: "its value cannot be used here" };

/** The parameters going out with the request, read-only: the fields sent under their wire names, what was left out and why, and the custom text. */
function RequestParamsView({ params }: { params: RequestParams }): JSX.Element | null {
  const sent = Object.keys(params.sent).length > 0;
  if (!sent && params.notSent.length === 0 && !params.customBody && !params.customExclude && !params.customHeaderNames?.length) return null;
  const custom = { ...(params.customHeaderNames?.length ? { headers: params.customHeaderNames } : {}), ...(params.customBody ? { body: params.customBody } : {}), ...(params.customExclude ? { remove: params.customExclude.split("\n").filter(Boolean) } : {}) };
  return (
    <label className="pi-msg" data-part="scene.inspector.params">
      <span>request parameters</span>
      <textarea readOnly rows={6} value={JSON.stringify({ sent: params.sent, ...(Object.keys(custom).length > 0 ? { custom } : {}), notSent: params.notSent.map((n) => `${n.id}: ${WHY[n.why] ?? n.why}`) }, null, 2)} />
    </label>
  );
}

export function PromptInspector({ review, onAnswer }: { review: Review; onAnswer(answer: { kind: "send"; edits: Record<number, string> } | { kind: "cancel" }): Promise<void> }): JSX.Element {
  const [drafts, setDrafts] = useState(() => review.messages.map((m) => m.content));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // The Context wing's Review tile (RoleCall: openModelCallReview) brings a dismissed review back.
  useEffect(() => {
    const open = (e: Event): void => { (e as CustomEvent<{ handled: boolean }>).detail.handled = true; setDismissed(false); };
    window.addEventListener(OPEN_REVIEW, open);
    return () => window.removeEventListener(OPEN_REVIEW, open);
  }, []);
  const edits = editsOf(review.messages, drafts);
  const changed = Object.keys(edits).length;
  const answer = (next: Parameters<typeof onAnswer>[0]): void => { setBusy(true); void onAnswer(next).finally(() => setBusy(false)); };
  const later = (): void => { if (!busy) setDismissed(true); };
  if (dismissed) return <button type="button" className="pi-paused" onClick={() => setDismissed(false)}>Turn paused for Prompt Inspector</button>;
  return (
    <InkDialog onDismiss={later} ariaLabel="Prompt Inspector" sheetClassName="pi-sheet">
      <div className="pi" data-part="scene.inspector">
        <header className="pi-top">
          <h2>Prompt Inspector</h2>
          <span className="pi-chip">about {review.tokens.toLocaleString()} tokens</span>
          <span className="pi-chip">Before send</span>
          <button type="button" aria-label="Close Prompt Inspector" onClick={later}><Ic name="lucide:x" /></button>
        </header>
        <div className="pi-body">
          {review.messages.map((m, i) => (
            <label key={i} className="pi-msg">
              <span>{m.role}</span>
              <textarea value={drafts[i]} rows={Math.min(12, Math.max(2, (drafts[i] ?? "").split("\n").length))} disabled={busy} onChange={(e) => setDrafts(drafts.map((d, j) => (j === i ? e.target.value : d)))} />
            </label>
          ))}
          {review.tools?.map((t) => (
            <label key={t.name} className="pi-msg" data-part="scene.inspector.tool">
              <span>tool: {t.name}</span>
              <textarea readOnly value={JSON.stringify({ description: t.description, parameters: t.parameters }, null, 2)} rows={6} />
            </label>
          ))}
          {review.params && <RequestParamsView params={review.params} />}
        </div>
        <footer {...protect("inspector-actions", "pi-acts")}>
          <button type="button" className="pi-btn" disabled={busy} onClick={later}>Review later</button>
          <button type="button" className="pi-btn" disabled={busy} onClick={() => answer({ kind: "cancel" })}>Stop turn</button>
          <button type="button" className="pi-btn go" disabled={busy} onClick={() => answer({ kind: "send", edits })}><Ic name="lucide:chevron-right" size={14} />{changed > 0 ? "Edit and send" : "Send"}</button>
        </footer>
      </div>
    </InkDialog>
  );
}
