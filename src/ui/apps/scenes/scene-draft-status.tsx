/**
 * The strip above the composer while a draft tool runs or has just run (RoleCall's composer ribbons and
 * PolishCompareDisclosure): the ribbon with its helper line and Cancel, the 1ST / 2ND / 3RD pill in expand mode,
 * the before / after disclosure with Revert after a polish, and a plain line for "Nothing to fix." or an error.
 * `PerspectivePill` is also what the "+" menu's Expand as character row draws inline. Presentational: the
 * state is `useComposerDrafts`.
 */
import { useState, type JSX } from "react";
import type { Perspective } from "../../../core/draft-prompts";
import { Ic } from "../../_shared/ic";
import { PERSPECTIVE_PILL, ribbonCopy } from "./draft-core";
import type { ComposerDrafts } from "./use-composer-drafts";

/** Picking a segment fires the expansion at once, as RoleCall's does; 1ST is lit until another is picked. */
export function PerspectivePill({ onPick, disabled }: { onPick(perspective: Perspective): void; disabled?: boolean }): JSX.Element {
  const [active, setActive] = useState<Perspective>("1st");
  return (
    <div className="ds-pill" role="group" aria-label="Perspective">
      {PERSPECTIVE_PILL.map((p) => (
        <button key={p.key} type="button" title={p.title} aria-pressed={active === p.key} disabled={disabled} onClick={() => { setActive(p.key); onPick(p.key); }}>{p.label}</button>
      ))}
    </div>
  );
}

export function DraftStatusStrip({ drafts, persona }: { drafts: ComposerDrafts; persona: string }): JSX.Element | null {
  const { status } = drafts;
  const [diff, setDiff] = useState(false);
  if (status.tag === "idle") return null;
  const ribbon = ribbonCopy(status, persona);
  return (
    <div className="ds" data-part="scene.composer.draft">
      {ribbon && (
        <div className="ds-rib" role="status">
          <span className="ds-eye">{status.tag === "working" && <Ic name="lucide:loader-circle" size={14} />}{ribbon.eyebrow}</span>
          <span className="ds-help">{ribbon.helper}</span>
          <button type="button" className="ds-btn" onClick={drafts.cancel}>Cancel</button>
        </div>
      )}
      {status.tag === "expand" && <PerspectivePill onPick={drafts.expand} />}
      {status.tag === "compare" && (
        <div className="ds-cmp">
          <div className="ds-rib">
            <span className="ds-eye">Polished</span>
            <span className="ds-help">Input updated. Review the diff or revert.</span>
            <button type="button" className="ds-btn" aria-expanded={diff} onClick={() => setDiff(!diff)}>{diff ? "Hide" : "Show"} diff</button>
            <button type="button" className="ds-btn" title="Restore original draft" onClick={() => { setDiff(false); drafts.revert(); }}>Revert</button>
            <button type="button" className="ds-btn" title="Keep polished, hide this panel" aria-label="Keep polished draft and close comparison" onClick={drafts.dismiss}><Ic name="lucide:x" size={14} /></button>
          </div>
          {diff && (
            <div className="ds-cols">
              <section><h4>Before</h4><pre>{status.before}</pre></section>
              <section><h4>After</h4><pre>{status.after}</pre></section>
            </div>
          )}
        </div>
      )}
      {(status.tag === "note" || status.tag === "error") && (
        <div className={`ds-rib${status.tag === "error" ? " bad" : ""}`} role={status.tag === "error" ? "alert" : "status"}>
          <span className="ds-help">{status.text}</span>
          <button type="button" className="ds-btn" aria-label="Dismiss" onClick={drafts.dismiss}><Ic name="lucide:x" size={14} /></button>
        </div>
      )}
    </div>
  );
}
