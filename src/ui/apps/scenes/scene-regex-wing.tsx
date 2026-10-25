/**
 * The Final Cut wing's Regex tab: RoleCall's RegexPanel on Bunraku. The library's regex sets as a list in the person's saved order,
 * each with a drag handle, its name, its description and its rule count; opening one shows Use (switch it on for THIS scene),
 * Edit (the Workbench) and Delete. A scene's switched-on sets run in the order they were switched on (ChatStore rule 42); a drag
 * reorders the list and the selected sets with it, as RoleCall does. Delete moves the set to the library's trash.
 */
import { useState, type DragEvent, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { toErrorMessage } from "../../_shared/error-message";
import { InkDialog } from "../../components/ink-dialog";
import { createAndOpenRegexSet } from "../library/new-regex-set";
import { REGEX_ORDER_KEY, inSavedOrder, movedTo, regexTabMeta, selectedInOrder } from "./scene-regex-core";
import type { SceneRegexPicks } from "./use-scene-regex-picks";

/** How the tab reads in the fold: "2 active" (RoleCall's "n active"), counting only sets the library still has. */
export const regexTabMetaOf = (picks: SceneRegexPicks): string => {
  const { library, on } = picks;
  return regexTabMeta(library.state === "ready" ? on.filter((id) => library.sets.some((s) => s.id === id)).length : on.length);
};

export function SceneRegexWing({ ctx, picks }: { ctx: AppContext; picks: SceneRegexPicks }): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState<unknown>(() => ctx.prefs.get(REGEX_ORDER_KEY));
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<StudioEntitySummary | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const { library } = picks;
  if (library.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading regex scripts...</div></div>;
  if (library.state === "failed") {
    return (
      <div className="wbody pp">
        <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">Regex Error</div><h2>Could not <em>load</em></h2><p>{library.why}</p></div>
          <div className="hero-tools"><button type="button" className="tbtn" title="Try again" onClick={picks.reload}><Ic name="lucide:refresh-cw" size={14} /></button></div>
        </header>
      </div>
    );
  }

  const list = inSavedOrder(library.sets, saved);
  const fail = (e: unknown, what: string): void => setError(toErrorMessage(e, what));
  const toggle = (id: string): void => { setError(null); void picks.setOn(id, !picks.on.includes(id)).catch((e: unknown) => fail(e, "The regex script could not be switched.")); };
  const fold = (id: string): void => setOpen((old) => { const next = new Set(old); if (!next.delete(id)) next.add(id); return next; });
  const reorder = (from: string, to: string): void => {
    const ids = movedTo(list.map((s) => s.id), from, to);
    ctx.prefs.set(REGEX_ORDER_KEY, ids);
    setSaved(ids);
    void picks.replace(selectedInOrder(ids, picks.on)).catch((e: unknown) => fail(e, "The regex scripts could not be reordered."));
  };
  const edit = (s: StudioEntitySummary): void => { ctx.workbench.open({ id: s.id, kind: "regex", name: s.name }); ctx.openApp("workbench"); };
  const make = (): void => {
    setError(null);
    createAndOpenRegexSet(ctx).then((made) => { picks.reload(); ctx.workbench.open({ id: made.id, kind: "regex", name: made.name }); ctx.openApp("workbench"); }, (e: unknown) => fail(e, "The regex script could not be made."));
  };
  const remove = async (s: StudioEntitySummary): Promise<void> => {
    setAsk(null);
    try {
      await ctx.api.deleteEntity("regex", s.id);
      if (picks.on.includes(s.id)) await picks.setOn(s.id, false);
      picks.reload();
    } catch (e) {
      fail(e, "The regex script could not be deleted.");
    }
  };
  const drop = (e: DragEvent, to: string): void => { e.preventDefault(); if (dragging) reorder(dragging, to); setDragging(null); };

  return (
    <div className="wbody pp rx-wing" data-part="scene.finalcut.regex">
      <header className="hero">
        <span className="hi"><Ic name="mdi:code-tags" size={20} /></span>
        <div><div className="eb">Text Transformations</div><h2>Regex <em>Scripts</em></h2><p>Pattern rules that rewrite messages before they reach the model: strip stage directions, normalize quotes, redact, or substitute on the fly.</p></div>
      </header>
      <div className="pg-rail">
        <button type="button" className="pg-new" onClick={make}><Ic name="lucide:plus" size={14} /> New Regex Script</button>
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
                  <button type="button" className="rx-grip" draggable title="Drag to reorder" aria-label={`Drag ${s.name} to reorder`} onDragStart={() => setDragging(s.id)} onDragEnd={() => setDragging(null)}
                    onKeyDown={(e) => {
                      const at = list.findIndex((x) => x.id === s.id);
                      const to = e.key === "ArrowUp" ? list[at - 1] : e.key === "ArrowDown" ? list[at + 1] : undefined;
                      if (to) { e.preventDefault(); reorder(s.id, to.id); }
                    }}><Ic name="lucide:grip-vertical" size={16} /></button>
                  <button type="button" className="rx-main" aria-expanded={isOpen} onClick={() => fold(s.id)}>
                    <Ic name={isOpen ? "lucide:chevron-down" : "lucide:chevron-right"} size={16} />
                    <span className="rx-text"><b>{s.name}</b>{s.facts?.description && <small>{s.facts.description}</small>}</span>
                    {rules !== undefined && <span className="rx-count"><b>{rules}</b><small>{rules === 1 ? "rule" : "rules"}</small></span>}
                  </button>
                </div>
                {isOpen && (
                  <div {...protect("regex-switches", "rx-acts")}>
                    <button type="button" className={`rx-use${on ? " on" : ""}`} title={on ? "Deselect" : "Select for chat"} aria-pressed={on} onClick={() => toggle(s.id)}><Ic name={on ? "lucide:circle-check" : "lucide:code-xml"} size={14} /> {on ? "Selected" : "Use"}</button>
                    <button type="button" className="rx-sq" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => edit(s)}><Ic name="lucide:pen" size={14} /></button>
                    <button type="button" className="rx-sq red" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => setAsk(s)}><Ic name="lucide:trash-2" size={14} /></button>
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
              <button type="button" className="no" autoFocus onClick={() => setAsk(null)}>Cancel</button>
              <button type="button" {...protect("regex-switches", "yes")} onClick={() => void remove(ask)}>Delete</button>
            </div>
          </div>
        </InkDialog>
      )}
    </div>
  );
}
