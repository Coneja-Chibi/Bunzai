/**
 * The Arcs tab (RoleCall's ArcsTab, ChapterArcGroup and ArcCard, StoryDirectorWingPanel.tsx:793-1157): Active, Completed and Abandoned, each grouped under its chapter, one card open at a time.
 * An open card shows the description, type, priority and scope, turns active, who is involved, the stages, the seeds planted for it and "Mark as Complete". NEW against RoleCall: the planned
 * next beat (the Director writes one every turn and RoleCall never shows it).
 */
import { useState, type JSX } from "react";
import { Ic, type IconName } from "../../../../_shared/ic";
import type { DirectorArc, DirectorState } from "../../../../../stage/contracts/director-types";
import { groupArcs, sectionArcs } from "./director-core";
import { Badge, Chevron, HorizonBadge, StatusBadge } from "./director-parts";

function ArcCard({ arc, seeds, open, onToggle, dimmed, onResolve, locked }: { arc: DirectorArc; seeds: DirectorState["seeds"]; open: boolean; onToggle(): void; dimmed: boolean; onResolve?: () => void; locked: boolean }): JSX.Element {
  const beat = arc.nextBeat?.status === "pending" ? arc.nextBeat : undefined;
  const planted = seeds.filter((s) => s.relatedArcId === arc.id);
  return (
    <div className={`dr-arc${dimmed ? " dim" : ""}${open ? " open" : ""}`} data-part="scene.director.arc">
      <button type="button" className="dr-arc-h" aria-expanded={open} onClick={onToggle}>
        <span className="dr-arc-t"><HorizonBadge horizon={arc.horizon} /><b>{arc.title}</b></span>
        <span className="dr-arc-s"><StatusBadge status={arc.status} /><Chevron open={open} /></span>
      </button>
      {open && (
        <div className="dr-arc-b">
          {arc.description && <p className="dr-dim big">{arc.description}</p>}
          <div className="dr-chips"><Badge>{arc.arcType}</Badge>{arc.priority !== "active" && <Badge tone={arc.priority === "urgent" ? "danger" : "mute"}>{arc.priority}</Badge>}<Badge>{arc.scope}</Badge></div>
          <div className="dr-meta">{arc.turnsActive > 0 && <span>{arc.turnsActive} turns active</span>}<span>{arc.horizon} horizon</span></div>
          {beat && (
            <div className="dr-beat" data-part="scene.director.arc.nextbeat">
              <span className="dr-beat-l"><Ic name="lucide:target" size={12} />Next beat</span>
              <p>{beat.description}</p>
              {beat.targetTurn !== undefined && <small>Planned for turn {beat.targetTurn}</small>}
            </div>
          )}
          {arc.involvedCharacters.length > 0 && <div className="dr-chips">{arc.involvedCharacters.map((n, i) => <Badge key={i} tone="info">{n}</Badge>)}</div>}
          {arc.stages.length > 0 && (
            <div>
              <div className="dr-sub"><Ic name="lucide:flag" size={12} />Stages ({arc.stages.length})</div>
              <div className="dr-stages">
                {arc.stages.map((s, i) => (
                  <div key={i} className={i === arc.stages.length - 1 ? "now" : ""}>
                    <span className="dr-stage-dot" />
                    <b>{s.title}</b>
                    {s.description && <p>{s.description}</p>}
                    <small>Turn {s.turn}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {planted.length > 0 && (
            <div>
              <div className="dr-sub"><Ic name="lucide:leaf" size={12} />Planted Seeds ({planted.length})</div>
              <div className="dr-seeds">
                {planted.map((s) => <div key={s.id} className={s.payoffDelivered ? "done" : ""}><Ic name="lucide:leaf" size={12} /><span>{s.hint}{!s.payoffDelivered && <small> ({s.payoffHorizon})</small>}</span></div>)}
              </div>
            </div>
          )}
          {onResolve && (
            <button type="button" className="dr-resolve" disabled={locked} data-part="scene.director.arc.complete" onClick={onResolve}><Ic name="lucide:circle-check" size={14} />Mark as Complete</button>
          )}
        </div>
      )}
    </div>
  );
}

export function ArcsTab({ state, onResolve, locked }: { state: DirectorState; onResolve(id: string): void; locked: boolean }): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);
  if (state.arcs.length === 0) {
    return <div className="dr-quiet" data-part="scene.director.arcs.empty"><Ic name="lucide:git-branch" size={32} /><p>No active story arcs yet</p></div>;
  }
  const { active, completed, abandoned } = sectionArcs(state.arcs);
  const block = (title: string, icon: IconName, list: DirectorArc[], dimmed: boolean): JSX.Element | null => list.length === 0 ? null : (
    <div className="dr-stack">
      <div className={`dr-grp-h ${icon}`}><Ic name={icon} size={14} /><span>{title} ({list.length})</span></div>
      {groupArcs(list, state.chapters).map((g) => (
        <div key={g.chapterId ?? "none"} className="dr-stack tight">
          <div className="dr-chap"><Ic name={g.chapterId ? "lucide:book-open" : "lucide:layers"} size={12} /><span>{g.label}</span><small>({g.arcs.length})</small></div>
          {g.arcs.map((a) => <ArcCard key={a.id} arc={a} seeds={state.seeds} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} dimmed={dimmed} locked={locked} {...(dimmed ? {} : { onResolve: () => onResolve(a.id) })} />)}
        </div>
      ))}
    </div>
  );
  return (
    <div className="dr-pane" data-part="scene.director.arcs">
      {block("Active", "lucide:git-branch", active, false)}
      {block("Completed", "lucide:circle-check", completed, true)}
      {block("Abandoned", "lucide:circle-x", abandoned, true)}
      {active.length === 0 && <div className="dr-quiet short"><p>No active arcs. All resolved.</p></div>}
    </div>
  );
}
