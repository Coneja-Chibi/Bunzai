/**
 * The strip above the composer while a draft tool runs or has just run (RoleCall's composer ribbons and
 * PolishCompareDisclosure): the ribbon with its helper line and Cancel, the 1ST / 2ND / 3RD pill in expand mode,
 * the before / after disclosure with Revert after a polish, and a plain line for "Nothing to fix." or an error.
 * `PerspectivePill` is also what the "+" menu's Expand as character row draws inline. Presentational: the
 * state is `useComposerDrafts`.
 */
import { useState, type JSX } from "react";
import type { Perspective } from "../../../core/draft-prompts";
import { Button, IconButton, Segmented } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { PERSPECTIVE_PILL, ribbonCopy } from "./draft-core";
import type { ComposerDrafts } from "./use-composer-drafts";

/** Picking a segment fires the expansion at once, as RoleCall's does; 1ST is lit until another is picked. */
export function PerspectivePill({ onPick, disabled }: { onPick(perspective: Perspective): void; disabled?: boolean }): JSX.Element {
  const [active, setActive] = useState<Perspective>("1st");
  return (
    <div className="ds-pill">
      <Segmented label="Perspective" size="sm" value={active} items={PERSPECTIVE_PILL.map((p) => ({ value: p.key, label: p.label, title: p.title, disabled }))} onChange={(key) => { setActive(key); onPick(key); }} />
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
          <Button variant="quiet" size="sm" onClick={drafts.cancel}>Cancel</Button>
        </div>
      )}
      {status.tag === "expand" && <PerspectivePill onPick={drafts.expand} />}
      {status.tag === "compare" && (
        <div className="ds-cmp">
          <div className="ds-rib">
            <span className="ds-eye">Polished</span>
            <span className="ds-help">Input updated. Review the diff or revert.</span>
            <Button size="sm" aria-expanded={diff} onClick={() => setDiff(!diff)}>{diff ? "Hide" : "Show"} diff</Button>
            <Button size="sm" title="Restore original draft" onClick={() => { setDiff(false); drafts.revert(); }}>Revert</Button>
            <IconButton variant="quiet" size="sm" title="Keep polished, hide this panel" label="Keep polished draft and close comparison" icon="lucide:x" onClick={drafts.dismiss} />
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
          <IconButton variant="quiet" size="sm" label="Dismiss" icon="lucide:x" onClick={drafts.dismiss} />
        </div>
      )}
    </div>
  );
}
