/**
 * The Prompting wing's Guides tab: RoleCall's GuidesPanel on Bunraku. Guided responses grouped by
 * category with counts, a New Guide button and a search; each row has a switch (use this guide in THIS
 * scene), its name and its mode pill; picking a row opens its editor below. The library is the person's,
 * the switches are the scene's own (ChatStore rule 37).
 */
import { useState, type JSX } from "react";
import type { GuideInput, GuideRecord } from "../../../core/guide-record";
import { Ic } from "../../_shared/ic";
import { toErrorMessage } from "../../_shared/error-message";
import { CATEGORY_ICON, CATEGORY_LABEL, MODE_META, activeCount, draftOf, groupGuides } from "./guides-core";
import { GuideEditor } from "./scene-guide-editor";
import type { ScenePrompting } from "./use-scene-prompting";
import { ToggleSwitch } from "../../components/toggle-switch";

/** How the tab reads in the fold: "2 active" (RoleCall's "n ACTIVE"). */
export const guidesTabMeta = (prompting: ScenePrompting, on: readonly string[]): string =>
  `${prompting.library.state === "ready" ? activeCount(prompting.library.guides, on) : on.length} active`;

export function SceneGuidesWing({ prompting, on }: { prompting: ScenePrompting; on: readonly string[] }): JSX.Element {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ id: string | null; draft: GuideInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { library } = prompting;

  if (library.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading guides...</div></div>;
  if (library.state === "failed") {
    return (
      <div className="wbody pp">
        <div className="pp-top">
          <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">Guides Error</div><h2>Could not <em>load</em></h2><p>{library.why}</p></div></header>
          <div className="hero-tools"><button type="button" className="tbtn" title="Try again" onClick={prompting.reload}><Ic name="lucide:refresh-cw" size={14} /></button></div>
        </div>
      </div>
    );
  }

  const { guides } = library;
  const show = (g: GuideRecord) => { setError(null); setOpen({ id: g.id, draft: draftOf(g) }); };
  const toggle = (id: string, enabled: boolean) => void prompting.setGuide(id, enabled).catch((e: unknown) => setError(toErrorMessage(e, "The guide could not be switched.")));
  const save = async () => {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await prompting.save({ ...open.draft, ...(open.id ? { id: open.id } : {}) });
      // Hidden guides leave the list, so there is nothing left to show open.
      if (saved.visible) setOpen({ id: saved.id, draft: draftOf(saved) });
      else {
        if (on.includes(saved.id)) await prompting.setGuide(saved.id, false);
        setOpen(null);
      }
    } catch (e) {
      setError(toErrorMessage(e, "The guide could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  const duplicate = async () => {
    if (!open) return;
    setError(null);
    try {
      const copy = await prompting.save({ ...open.draft, title: `${open.draft.title.trim() || "Untitled"} (Copy)` });
      show(copy);
    } catch (e) {
      setError(toErrorMessage(e, "The guide could not be copied."));
    }
  };
  const remove = async () => {
    if (!open?.id) return;
    try {
      await prompting.remove(open.id);
      if (on.includes(open.id)) await prompting.setGuide(open.id, false);
      setOpen(null);
    } catch (e) {
      setError(toErrorMessage(e, "The guide could not be deleted."));
    }
  };

  const groups = groupGuides(guides, query);
  return (
    <div className="wbody pp pg-guides" data-part="scene.prompting.guides">
      <div className="pp-top">
        <header className="hero compact">
          <span className="hi"><Ic name="lucide:book-open" size={20} /></span>
          <div><div className="eb">Guides · {activeCount(guides, on)} active</div><h2>{open && !open.id ? <>New <em>Guide</em></> : <>Guided <em>Responses</em></>}</h2></div>
        </header>
      </div>
      <div className="pg-body">
      {!open && error && <div className="note" role="alert">{error}</div>}
      <div className="pg-rail">
        <button type="button" className="pg-new" onClick={() => { setError(null); setOpen({ id: null, draft: draftOf() }); }}><Ic name="lucide:plus" size={15} /> New Guide</button>
        <label className="pg-search"><Ic name="lucide:search" size={14} /><input value={query} placeholder="Search guides..." aria-label="Search guides" onChange={(e) => setQuery(e.target.value)} /></label>
        {guides.length === 0 && <div className="ed-note">No guides yet. Make one with New Guide.</div>}
        {groups.map(({ category, rows }) => (
          <div key={category} className="pg-group">
            <div className={`pg-cat c-${category}`}><Ic name={CATEGORY_ICON[category]} size={14} /><b>{CATEGORY_LABEL[category]}</b><small>{rows.length}</small></div>
            {rows.map((g) => (
              <div key={g.id} className={`pg-row${open?.id === g.id ? " sel" : ""}`}>
                <ToggleSwitch size="sm" on={on.includes(g.id)} aria-label={`Use ${g.title} in this scene`} title="Use in this scene: switches the guide on for this scene only" onChange={() => toggle(g.id, !on.includes(g.id))} />
                <button type="button" className="pg-title" onClick={() => show(g)}>{g.title || "Untitled"}</button>
                <span className={`pg-pill m-${g.mode}`}>{MODE_META[g.mode].pill}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {open && (
        <GuideEditor draft={open.draft} creating={!open.id} on={open.id !== null && on.includes(open.id)} busy={busy} error={error}
          onChange={(draft) => setOpen({ ...open, draft })} onToggleOn={() => open.id && toggle(open.id, !on.includes(open.id))}
          onDuplicate={() => void duplicate()} onDelete={remove} onCancel={() => { setError(null); setOpen(null); }} onSave={() => void save()} />
      )}
      </div>
    </div>
  );
}
