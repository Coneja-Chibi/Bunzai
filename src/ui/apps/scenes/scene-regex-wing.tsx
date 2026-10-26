/**
 * The Final Cut wing's Regex tab: RoleCall's RegexPanel on Bunraku. The library's regex sets as a list in the person's saved order,
 * each with a drag handle, its name, its description and its rule count; opening one shows Use (switch it on for THIS scene),
 * Edit (the Workbench) and Delete. A scene's switched-on sets run in the order they were switched on (ChatStore rule 42); a drag
 * reorders the list and the selected sets with it, as RoleCall does. Delete moves the set to the library's trash.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { InkDialog } from "../../components/ink-dialog";
import { regexTabMeta } from "./scene-regex-core";
import { useRegexActions } from "./scene-regex-actions";
import type { SceneRegexPicks } from "./use-scene-regex-picks";
import { Chip, Disclosure, IconButton, Button } from "../../components/button";

/** How the tab reads in the fold: "2 active" (RoleCall's "n active"), counting only sets the library still has. */
export const regexTabMetaOf = (picks: SceneRegexPicks): string => {
  const { library, on } = picks;
  return regexTabMeta(library.state === "ready" ? on.filter((id) => library.sets.some((s) => s.id === id)).length : on.length);
};

export function SceneRegexWing({ ctx, picks }: { ctx: AppContext; picks: SceneRegexPicks }): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const { list, error, ask, setAsk, dragging, setDragging, toggle, edit, make, remove, drop, gripKey } = useRegexActions(ctx, picks);
  const { library } = picks;
  if (library.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading regex scripts...</div></div>;
  if (library.state === "failed") {
    return (
      <div className="wbody pp">
        <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">Regex Error</div><h2>Could not <em>load</em></h2><p>{library.why}</p></div>
          <div className="hero-tools"><IconButton variant="quiet" size="sm" icon="lucide:refresh-cw" label="Try again" onClick={picks.reload} /></div>
        </header>
      </div>
    );
  }

  const fold = (id: string): void => setOpen((old) => { const next = new Set(old); if (!next.delete(id)) next.add(id); return next; });

  return (
    <div className="wbody pp rx-wing" data-part="scene.finalcut.regex">
      <header className="hero">
        <span className="hi"><Ic name="mdi:code-tags" size={20} /></span>
        <div><div className="eb">Text Transformations</div><h2>Regex <em>Scripts</em></h2><p>Pattern rules that rewrite messages before they reach the model: strip stage directions, normalize quotes, redact, or substitute on the fly.</p></div>
      </header>
      <div className="pg-rail">
        <Button variant="primary" size="sm" icon="lucide:plus" onClick={make}>New Regex Script</Button>
      </div>
      {list.length === 0 ? (
        <div className="rx-none"><span className="box"><Ic name="lucide:code-xml" size={24} /></span><b>No regex scripts yet</b><small>Create or import regex scripts to get started</small></div>
      ) : (
        <div className="rx-list">
          {list.map((s) => {
            const on = picks.on.includes(s.id);
            const rules = s.facts?.regex?.ruleCount;
            const isOpen = open.has(s.id);
            return (
              <div key={s.id} className={`rx-item${on ? " on" : ""}${dragging === s.id ? " drag" : ""}`} onDragOver={(e) => dragging && e.preventDefault()} onDrop={(e) => drop(e, s.id)}>
                <div className="rx-head">
                  <IconButton variant="quiet" size="sm" icon="lucide:grip-vertical" draggable title="Drag to reorder" label={`Drag ${s.name} to reorder`} onDragStart={() => setDragging(s.id)} onDragEnd={() => setDragging(null)}
                    onKeyDown={(e) => gripKey(e, s.id)} />
                  <Disclosure open={isOpen} onClick={() => fold(s.id)}
                    label={<span className="rx-text"><b>{s.name}</b>{s.facts?.description && <small>{s.facts.description}</small>}</span>}
                    summary={rules !== undefined ? <span className="rx-count"><b>{rules}</b><small>{rules === 1 ? "rule" : "rules"}</small></span> : undefined} />
                </div>
                {isOpen && (
                  <div {...protect("regex-switches", "rx-acts")}>
                    <Chip pressed={on} title={on ? "Deselect" : "Select for chat"} onClick={() => toggle(s.id)}><Ic name={on ? "lucide:circle-check" : "lucide:code-xml"} size={14} /> {on ? "Selected" : "Use"}</Chip>
                    <IconButton variant="quiet" size="sm" icon="lucide:pen" label={`Edit ${s.name}`} title="Edit" onClick={() => edit(s)} />
                    <IconButton variant="danger" size="sm" icon="lucide:trash-2" label={`Delete ${s.name}`} title="Delete" onClick={() => setAsk(s)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <div className="note" role="alert">{error}</div>}
      {ask && (
        <InkDialog onDismiss={() => setAsk(null)} ariaLabel="Delete regex script">
          <div className="scn-cut">
            <div className="eb">{ask.name}</div>
            <h3>Delete <em>script?</em></h3>
            <p>Are you sure you want to delete this regex script?</p>
            <div className="row">
              <Button autoFocus onClick={() => setAsk(null)}>Cancel</Button>
              <span {...protect("regex-switches")}><Button variant="danger" onClick={() => void remove(ask)}>Delete</Button></span>
            </div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}
