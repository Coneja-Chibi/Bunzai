/**
 * The Debug tab (RoleCall's DebugTab, StoryDirectorWingPanel.tsx:1474-1767): the spoiler warning, "Show Debug Data" / "Hide Spoilers", then the Director's hidden state as sections that open one at
 * a time: Shadow World (hidden arcs and DM Notes), Narrative Seeds, and the raw hidden data. RoleCall's Tool Calls, Storyboards AI Context, NPC Off-Screen Actions, Parallel Timelines and Memory
 * Updates are not drawn: nothing in Bunraku writes them. NEW: the last directive as raw data, what was removed and is kept for you, and how full the story is.
 */
import { useState, type JSX, type ReactNode } from "react";
import { Button, Disclosure, IconButton } from "../../../../components/button";
import { Ic, type IconName } from "../../../../_shared/ic";
import type { DirectorState } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { overdueOf, seedStatus, sizeReadout } from "./director-core";
import { Badge } from "./director-parts";
import { HiddenWorld, type EditFn } from "./debug-hidden";

function Fold({ id, title, icon, count, open, onToggle, children }: { id: string; title: string; icon: IconName; count?: number; open: boolean; onToggle(): void; children: ReactNode }): JSX.Element {
  return (
    <div className="dr-fold" data-part={`scene.director.debug.${id}`}>
      <Disclosure open={open} onClick={onToggle} leading={<Ic name={icon} size={14} />} label={title} trailing={count !== undefined && count > 0 ? <Badge>{count}</Badge> : undefined} />
      {open && <div className="dr-fold-b">{children}</div>}
    </div>
  );
}

function Seeds({ state, onEdit, locked }: { state: DirectorState; onEdit: EditFn; locked: boolean }): JSX.Element {
  return (
    <div className="dr-stack tight">
      {state.seeds.map((s) => {
        const due = overdueOf(s.payoffHorizon, s.turnsActive);
        const last = s.reinforcements.at(-1);
        const status = seedStatus(s);
        return (
          <div key={s.id} className="dr-seed">
            <Ic name="lucide:leaf" size={14} />
            <div>
              <div className="dr-chips"><b>{s.hint || "Unnamed seed"}</b><Badge tone={status === "resolved" ? "info" : "ok"}>{status}</Badge><Badge tone={due.overdue ? "danger" : "mute"}>{due.text}</Badge></div>
              {s.payoff && <p className="dr-dim">{s.payoff}</p>}
              {last && <p className="dr-ok-text"><span>Reinforced:</span> {last.description}</p>}
              <p className="dr-warn-text"><span>Payoff:</span> {s.payoffHorizon}</p>
            </div>
            <IconButton variant="danger" size="sm" label={`Delete seed ${s.hint}`} title="Delete seed" icon="lucide:trash-2" disabled={locked} onClick={() => void onEdit({ op: "remove-seed", id: s.id }, "The seed could not be deleted. Refresh and try again.")} />
          </div>
        );
      })}
    </div>
  );
}

export function DebugTab({ panel, onEdit, locked }: { panel: DirectorPanel; onEdit: EditFn; locked: boolean }): JSX.Element {
  const [show, setShow] = useState(false);
  const [fold, setFold] = useState<string | null>(null);
  const { state, archived, size } = panel;
  const toggle = (id: string): void => setFold(fold === id ? null : id);
  const read = sizeReadout(size);
  const removed = archived.notes.length + archived.hidden.length;
  return (
    <div className="dr-pane" data-part="scene.director.debug">
      <div className="dr-warn" role="note"><Ic name="lucide:circle-alert" size={16} /><span>Debug data contains story spoilers and hidden DM information.</span></div>
      <Button size="sm" block icon={show ? "lucide:eye-off" : "lucide:eye"} aria-pressed={show} data-part="scene.director.debug.toggle" onClick={() => setShow(!show)}>{show ? "Hide Spoilers" : "Show Debug Data"}</Button>
      {show && (
        <div className="dr-stack">
          <Fold id="shadow" title="Shadow World" icon="lucide:ghost" count={state.invisibleArcs.length + state.notes.length} open={fold === "shadow"} onToggle={() => toggle("shadow")}>
            <HiddenWorld arcs={state.invisibleArcs} notes={state.notes} onEdit={onEdit} locked={locked} />
          </Fold>
          {state.seeds.length > 0 && <Fold id="seeds" title="Narrative Seeds" icon="lucide:leaf" count={state.seeds.length} open={fold === "seeds"} onToggle={() => toggle("seeds")}><Seeds state={state} onEdit={onEdit} locked={locked} /></Fold>}
          <Fold id="raw" title="Raw DM Hidden Data" icon="lucide:braces" open={fold === "raw"} onToggle={() => toggle("raw")}>
            <pre className="dr-raw">{JSON.stringify({ invisibleArcs: state.invisibleArcs, seeds: state.seeds, notes: state.notes }, null, 2)}</pre>
          </Fold>
          {state.lastDirective && <Fold id="directive" title="Last Directive" icon="lucide:braces" open={fold === "directive"} onToggle={() => toggle("directive")}><pre className="dr-raw">{JSON.stringify(state.lastDirective, null, 2)}</pre></Fold>}
          <div className="dr-card sm dr-store" data-part="scene.director.debug.store">
            <div className="dr-row"><span>Story size</span><b className={read.near ? "warn" : ""}>{read.text}</b></div>
            {read.near && <p className="dr-warn-text">The story is close to its size limit. Delete notes or hidden arcs you no longer need; they are kept for you, outside the story.</p>}
            <div className="dr-row"><span>Deleted and kept</span><b data-part="scene.director.debug.archived">{archived.notes.length} {archived.notes.length === 1 ? "note" : "notes"}, {archived.hidden.length} hidden {archived.hidden.length === 1 ? "arc" : "arcs"}</b></div>
            {removed === 0 && <p className="dr-dim">Nothing deleted yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
