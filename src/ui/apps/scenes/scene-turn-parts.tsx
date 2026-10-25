/**
 * A turn's pieces as the approved wireframe rc-port/scene-turn.html draws them: RoleCall's Starting
 * chip, ImmersiveMessage's meta row with the SwipeCounter (scene-meta.tsx), its failure card, Bunraku's two additions
 * (the line on a reply a crash cut off and the card holding a reply the take moved past), and
 * LiveBubble, the streaming reply's own bubble. Text is shown as text, never
 * as HTML.
 */
import type { CSSProperties, JSX } from "react";
import type { Speaker } from "../../../core/participants/roster";
import { Ic } from "../../_shared/ic";
import { Bubble } from "./scene-bubble";
import type { ReasoningFormat } from "../../../core/reasoning-tags";
import { reasoningOf } from "./scene-reasoning-core";
import type { LiveTurn } from "./use-scene-turn";

export function Starting(): JSX.Element {
  return <div className="starting" role="status"><Ic name="lucide:loader-circle" />Starting...</div>;
}

/** RoleCall's status while Final Cut's passes run before the reply is saved, on any kind of turn; the title names the pass. */
export function FinalCutStatus({ pass }: { pass: string }): JSX.Element {
  return <div className="starting" role="status" title={pass}><Ic name="lucide:loader-circle" />Final Cut pass...</div>;
}

/** The reply being written, in its own bubble: no message id yet, so none of Bubble's edit/branch/cut
 * actions apply. Re-renders once per rAF-coalesced flush of the streamed text (use-scene-turn.ts);
 * finished bubbles are memoized and never re-render because of it. */
export function LiveBubble({ n, who, tone, art, live, format, prefs, speakers }: { speakers?: readonly Speaker[] | undefined; n: number; who: string; tone: CSSProperties; art: JSX.Element; live: LiveTurn; format: ReasoningFormat | undefined; prefs: { get(key: string): unknown } }): JSX.Element {
  const { props, reply } = reasoningOf({ key: `turn:${live.turnId}`, content: undefined, gen: undefined, format, live, prefs });
  return <Bubble id="live" n={n} who={who} tone={tone} art={art} text={reply} speakers={speakers} live {...props} onCopy={() => Promise.resolve(false)} />;
}

export function CutOff({ busy, onRegenerate }: { busy: boolean; onRegenerate(): void }): JSX.Element {
  return (
    <div className="cutoff"><Ic name="lucide:circle-alert" size={14} /><span className="grow">Cut off when Bunraku closed. <small>What arrived is kept.</small></span>
      <button type="button" disabled={busy} onClick={onRegenerate}>Regenerate</button></div>
  );
}

/** RoleCall's failure card: the draft shows, and is not saved. Retry asks again for the same message. */
export function FailCard({ code, message, draft, onDismiss, onRetry }: { code: string; message: string; draft: string; onDismiss(): void; onRetry?: () => void }): JSX.Element {
  return (
    <div className="fail" role="alert">
      <div className="top">
        <span className="ic"><Ic name="lucide:circle-alert" size={20} /></span>
        <div><div className="tt">Generation Failed</div><div className="ln"><code>{code}</code>{message}</div></div>
        <button type="button" className="dis" onClick={onDismiss}>Dismiss</button>
        {onRetry && <button type="button" className="dis go" onClick={onRetry}>Retry</button>}
      </div>
      {draft && (
        <div className="dr">Interrupted draft (not saved)
          <textarea readOnly value={draft} aria-label="Interrupted draft" />
          <p className="nb">Copy any text you want to keep before dismissing or retrying. This incomplete text is only available in this tab and is not saved to the scene.</p>
        </div>
      )}
    </div>
  );
}

/** Bunraku: the take changed while the reply was written; the reply waits to be added or discarded. */
export function HeldCard({ draft, onDiscard, onKeep }: { draft: string; onDiscard(): void; onKeep(): void }): JSX.Element {
  return (
    <div className="fail held" role="alert">
      <div className="top">
        <span className="ic warn"><Ic name="lucide:circle-alert" size={20} /></span>
        <div><div className="tt">The scene changed while it answered</div><div className="ln">Something was added to this take while the reply was being written. The reply is kept, waiting.</div></div>
        <button type="button" className="dis" onClick={onDiscard}>Discard</button>
        <button type="button" className="dis go" onClick={onKeep}>Add it at the end</button>
      </div>
      <div className="dr">Waiting reply<textarea readOnly value={draft} aria-label="Waiting reply" /></div>
    </div>
  );
}
