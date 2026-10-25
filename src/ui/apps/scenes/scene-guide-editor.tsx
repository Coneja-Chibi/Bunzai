/**
 * The Guides tab's editor for one guide: RoleCall's embedded GuideEntryPanel. Name with Duplicate and
 * Delete, then the switch for this scene with the role and the category, the content with its macro chips
 * and token estimate, the placement (Std, Depth, Append, Macro, Start) with its depth or macro target, and
 * an Advanced fold. Cancel and Save sit under it. Presentational: the wing owns the save.
 */
import { useState, type JSX } from "react";
import { GUIDE_CATEGORIES, GUIDE_DEPTH_MAX, GUIDE_TYPES, GUIDE_CONTENT_MAX, GUIDE_TITLE_MAX, MACRO_TARGETS, type GuideInput } from "../../../core/guide-record";
import type { GuideMode } from "../../../core/assembly/guides";
import { countText } from "../../../core/tokens";
import { Ic, type IconName } from "../../_shared/ic";
import { ToggleSwitch } from "../../components/toggle-switch";
import { CATEGORY_ICON, CATEGORY_LABEL, MODE_META, TYPE_META, withMode } from "./guides-core";

const MODES: readonly GuideMode[] = ["standard", "depth", "append", "macro", "chat_start"];
const ROLES = ["system", "user", "assistant"] as const;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** RoleCall's PLACEMENT_ICONS (guides-editor/primitives.tsx:38). */
const MODE_ICON: Readonly<Record<GuideMode, IconName>> = { standard: "lucide:list-ordered", depth: "lucide:layers", append: "lucide:corner-down-right", macro: "lucide:link", chat_start: "lucide:play" };

export function GuideEditor({ draft, creating, on, busy, error, onChange, onToggleOn, onDuplicate, onDelete, onCancel, onSave }: {
  draft: GuideInput;
  creating: boolean;
  /** Whether this guide is switched on for the scene; a new guide has no switch yet. */
  on: boolean;
  busy: boolean;
  error: string | null;
  onChange(next: GuideInput): void;
  onToggleOn(): void;
  onDuplicate(): void;
  onDelete(): Promise<void>;
  onCancel(): void;
  onSave(): void;
}): JSX.Element {
  const [advanced, setAdvanced] = useState(false);
  const [asking, setAsking] = useState(false);
  const set = (change: Partial<GuideInput>) => onChange({ ...draft, ...change });
  const macro = (text: string) => set({ content: draft.content + (draft.content && !draft.content.endsWith(" ") ? " " : "") + text });
  const tokens = countText(draft.content);
  return (
    <div className="pg-editor">
      <div className="pg-ehead">
        <span className={`pg-ic c-${draft.category}`}><Ic name={CATEGORY_ICON[draft.category]} size={16} /></span>
        <input className="pg-name" value={draft.title} maxLength={GUIDE_TITLE_MAX} placeholder="Guide name..." aria-label="Guide name" onChange={(e) => set({ title: e.target.value })} />
        {!creating && (
        <>
            <button type="button" className="tbtn" title="Duplicate" onClick={onDuplicate}><Ic name="lucide:copy" size={15} /></button>
            <button type="button" className="tbtn red" title="Delete" onClick={() => setAsking(true)}><Ic name="lucide:trash-2" size={15} /></button>
        </>
        )}
      </div>
      {asking && (
        <div className="note" role="alert">
          Delete this guide? It leaves every list and every scene using it; the library keeps the record.
          <span className="pg-ask"><button type="button" className="pg-btn red" onClick={() => void onDelete()}>Delete</button><button type="button" className="pg-btn" onClick={() => setAsking(false)}>Keep</button></span>
        </div>
      )}
      <div className="pg-controls pg-top">
        {!creating && <ToggleSwitch size="sm" on={on} aria-label="Use in this scene" title="Use in this scene: switches the guide on for this scene only" onChange={onToggleOn} />}
        <select value={draft.role} aria-label="Injection role" onChange={(e) => set({ role: e.target.value as GuideInput["role"] })}>{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</select>
        <select value={draft.category} aria-label="Category" onChange={(e) => set({ category: e.target.value as GuideInput["category"] })}>{GUIDE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
      </div>

      <div className="pg-label"><Ic name="lucide:pencil" size={12} /><span>Content</span></div>
      <textarea className="pg-content" value={draft.content} maxLength={GUIDE_CONTENT_MAX} aria-label="Guide content" placeholder="What should the AI be told?" onChange={(e) => set({ content: e.target.value })} />
      <div className="pg-foot">
        <span>{["{{user}}", "{{char}}"].map((m) => <button type="button" key={m} className="pg-mac" title={`Insert ${m}`} onClick={() => macro(m)}>{m}</button>)} macros</span>
        <span>~{tokens} token{tokens === 1 ? "" : "s"}</span>
      </div>

      <div className="pg-label"><Ic name="lucide:sliders-horizontal" size={12} /><span>Placement</span></div>
      <div className="pg-modes">
        {MODES.map((m) => <button type="button" key={m} className={`pg-mode m-${m}${draft.mode === m ? " on" : ""}`} title={MODE_META[m].hint} aria-pressed={draft.mode === m} onClick={() => onChange(withMode(draft, m))}><Ic name={MODE_ICON[m]} size={14} />{MODE_META[m].pill}</button>)}
      </div>
      {draft.mode === "macro" && (
        <div className="pg-controls">
          <select value={draft.target ?? "persona"} aria-label="Target macro" onChange={(e) => set({ target: e.target.value as GuideInput["target"] })}>{MACRO_TARGETS.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
          <select value={draft.side ?? "append"} aria-label="Side" onChange={(e) => set({ side: e.target.value as GuideInput["side"] })}><option value="append">Append</option><option value="prepend">Prepend</option></select>
        </div>
      )}
      {(draft.mode === "depth" || draft.mode === "append") && (
        <div className="pg-controls">
          <input type="number" className="pg-num" min={0} max={GUIDE_DEPTH_MAX} value={draft.depth ?? 0} aria-label="Depth"
            onChange={(e) => set({ depth: Math.max(0, Math.min(GUIDE_DEPTH_MAX, Math.floor(Number(e.target.value) || 0))) })} />
          <span className="pg-help">{draft.mode === "append" ? "messages back (0 = the latest)" : "messages from the end"}</span>
        </div>
      )}

      <div className="pg-acc">
      <button type="button" className={`pg-fold${advanced ? " on" : ""}`} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><Ic name="lucide:settings" size={15} />Advanced <Ic name={advanced ? "lucide:chevron-up" : "lucide:chevron-down"} size={15} /></button>
      {advanced && (
        <div className="pg-acc-body">
          <div className="pg-adv">
            <div><b>Type</b><small>{TYPE_META[draft.type]}</small></div>
            <select value={draft.type} aria-label="Guide type" onChange={(e) => set({ type: e.target.value as GuideInput["type"] })}>{GUIDE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
          </div>
          <div className="pg-adv">
            <div><b>Visible in Library</b><small>{draft.visible ? "Visible: shows up in your lists" : "Hidden: hidden everywhere, and left out of every prompt (saved on Save)"}</small></div>
            <ToggleSwitch size="sm" on={draft.visible} aria-label="Visible in Library" onChange={() => set({ visible: !draft.visible })} />
          </div>
        </div>
      )}
      </div>

      {error && <div className="note" role="alert">{error}</div>}
      <div className="pg-actions">
        <button type="button" className="pg-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="pg-btn go" disabled={busy} onClick={onSave}><Ic name="lucide:check" size={14} />{busy ? "Saving..." : "Save"}</button>
      </div>
    </div>
  );
}
