/**
 * The meta row under a message, as RoleCall's ImmersiveMessage draws it (rc-port/scene-turn.html) grown to
 * every message with its header facts (rc-port/scene-meta.html): the time, for a reply the model, how
 * long it took and the provider's finish reason, then the SwipeCounter.
 */
import type { JSX } from "react";
import { Ic } from "../../_shared/ic";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { finishChip } from "./scene-meta-core";

/** What one message says about itself under its bubble: when it was written, and for a reply the model,
 * how long it took and why it stopped (RoleCall's header facts), then the version counter. */
export interface MetaFacts {
  stamp?: string | undefined;
  model?: string | undefined;
  genTime?: string | undefined;
  finish?: string | undefined;
}

export function MetaRow(p: MetaFacts & {
  /** Present on a reply with several versions and on the take's last reply. */
  versions?: {
    index: number;
    count: number;
    isNew: boolean;
    busy: boolean;
    onPrev(): void;
    onNext(): void;
    /** Only the take's last reply regenerates (turn-loop rule 5); older replies stop at their newest version. */
    onRegenerate?(): void;
    /** Jump to a version: the dots variant of scene.swipes. */
    onGo?(index: number): void;
    /** RoleCall's Compare versions (a reply with more than one saved version): opens the side-by-side view. */
    onCompare?(): void;
  } | undefined;
}): JSX.Element | null {
  const dots = useSurfaceVariant("scene.swipes") === "dots";
  const label = [p.model, p.genTime].filter(Boolean).join(" · ");
  const chip = finishChip(p.finish);
  const v = p.versions;
  if (!p.stamp && !label && !chip && !v) return null;
  const newest = v ? v.index === v.count - 1 : false;
  return (
    <div className="meta">
      {p.stamp && <span className="ts">{p.stamp}</span>}
      {label && <span className="mdl">{label}</span>}
      {chip && <span className={`fin ${chip.tone}`} title={chip.title}>{chip.label}</span>}
      {v && (
        <span className={`swc${v.isNew ? " new" : ""}`} data-part="scene.swipes">
          <button type="button" disabled={v.index === 0 || v.busy} title={v.index === 0 ? "No previous version" : "Previous version"} aria-label="Previous version" onClick={v.onPrev}><Ic name="lucide:chevron-left" /></button>
          {dots && v.onGo && (
            <span className="vdots">{Array.from({ length: v.count }, (_, i) => (
              <button type="button" key={i} className={i === v.index ? "on" : undefined} disabled={v.busy} aria-label={`Version ${i + 1}`} aria-current={i === v.index} onClick={() => v.onGo?.(i)} />
            ))}</span>
          )}
          <span className="ct"><span className="n">{v.index + 1}</span><span className="sl">/</span><span className="t">{v.count}</span>{v.isNew && <span className="nw">new</span>}</span>
          {v.onCompare && <button type="button" title="Compare versions" aria-label="Compare versions" onClick={v.onCompare}><Ic name="lucide:columns-2" /></button>}
          {newest && v.onRegenerate
            ? <button type="button" disabled={v.busy} title={v.busy ? "Generation in progress" : "Regenerate"} aria-label="Regenerate" onClick={v.onRegenerate}><Ic name="lucide:rotate-ccw" /></button>
            : <button type="button" disabled={v.busy || newest} title={newest ? "No newer version" : "Next version"} aria-label="Next version" onClick={v.onNext}><Ic name="lucide:chevron-right" /></button>}
        </span>
      )}
    </div>
  );
}
