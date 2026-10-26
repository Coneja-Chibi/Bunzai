/**
 * Custom Banks (RoleCall's UserBanksCard.tsx): the banks you wrote for the Anti-Slop pass, kept in your library. Each row has its switch
 * (off keeps the bank, on fires it in every scene's Anti-Slop pass), a view, an edit and a delete that asks twice; "+ New Bank" opens the same
 * form. RoleCall's copy offers asking Orison in /btw to draft one; Bunraku has no such agent, so the line stops at "Author your own bank below."
 * Delete is soft: the bank leaves the list and the prompt and the library keeps the record.
 */
import { useState, type JSX } from "react";
import { Button, IconButton } from "../../../components/button";
import { BANK_KINDS, BANK_SCOPES } from "../../../../core/final-cut/banks";
import type { BankRecord } from "../../../../studio/final-cut-library";
import type { FinalCutLibrary } from "./use-final-cut-library";

interface Draft { id?: string; bankId: string; label: string; kind: string; scope: string; pattern: string; examples: string[]; replace: string; why: string }

const empty = (): Draft => ({ bankId: "", label: "", kind: "phrase", scope: "always", pattern: "", examples: [""], replace: "", why: "" });
const draftOf = (b: BankRecord): Draft => ({ id: b.id, bankId: b.bankId.replace(/^user\//, ""), label: b.label, kind: b.kind, scope: b.scope, pattern: b.pattern, examples: [...b.examples], replace: b.replace, why: b.why ?? "" });

function Form({ draft, set }: { draft: Draft; set(next: Draft): void }): JSX.Element {
  return (
    <div className="fc-bankform">
      <div className="fc-grid">
        <label className="fc-label">Label<input className="fc-field" value={draft.label} maxLength={120} placeholder="Melodrama tells" onChange={(e) => set({ ...draft, label: e.target.value })} /></label>
        <label className="fc-label">Bank id slug<input className="fc-field mono" value={draft.bankId} placeholder="melodrama-tells" onChange={(e) => set({ ...draft, bankId: e.target.value })} /></label>
      </div>
      <div className="fc-grid">
        <label className="fc-label">Kind<select className="fc-select" value={draft.kind} onChange={(e) => set({ ...draft, kind: e.target.value })}>{BANK_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="fc-label">Scope<select className="fc-select" value={draft.scope} onChange={(e) => set({ ...draft, scope: e.target.value })}>{BANK_SCOPES.map((k) => <option key={k}>{k}</option>)}</select></label>
      </div>
      <label className="fc-label">Pattern<textarea className="fc-area" value={draft.pattern} maxLength={8000} placeholder="Describe the pattern the agent should watch for..." onChange={(e) => set({ ...draft, pattern: e.target.value })} /></label>
      <label className="fc-label">Replacement guidance<textarea className="fc-area" value={draft.replace} maxLength={4000} placeholder="Concrete guidance the rewriter should follow..." onChange={(e) => set({ ...draft, replace: e.target.value })} /></label>
      <label className="fc-label">Why this fails (optional)<textarea className="fc-area" value={draft.why} maxLength={4000} onChange={(e) => set({ ...draft, why: e.target.value })} /></label>
      <div className="fc-label">Examples<small>{draft.examples.length} of 30</small></div>
      {draft.examples.map((example, i) => (
        <div className="fc-example" key={i}>
          <input className="fc-field" value={example} maxLength={1000} placeholder="Example phrase" aria-label={`Example ${i + 1}`} onChange={(e) => set({ ...draft, examples: draft.examples.map((x, j) => (j === i ? e.target.value : x)) })} />
          <IconButton variant="quiet" size="sm" label="Remove example" icon="lucide:x" disabled={draft.examples.length === 1} onClick={() => set({ ...draft, examples: draft.examples.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Button size="sm" disabled={draft.examples.length >= 30} onClick={() => set({ ...draft, examples: [...draft.examples, ""] })}>+ Add example</Button>
    </div>
  );
}

export function UserBanksCard({ lib }: { lib: FinalCutLibrary }): JSX.Element {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const enabled = lib.banks.filter((b) => b.enabled).length;
  const save = async (): Promise<void> => {
    if (!draft) return;
    setSaving(true);
    const made = await lib.saveBank({ ...draft, examples: draft.examples.map((e) => e.trim()).filter(Boolean), ...(draft.id ? { id: draft.id } : {}) });
    setSaving(false);
    if (made) setDraft(null);
  };
  return (
    <section className="fc-card fc-banks" style={{ "--p": "var(--stage-danger-text)" } as React.CSSProperties} data-part="scene.finalcut.banks">
      <header>
        <div>
          <h3>Custom Banks</h3>
          <p>{lib.state === "loading" ? "Loading..." : lib.banks.length === 0 ? "Author your own bank below." : `${enabled} of ${lib.banks.length} firing in your anti-slop pipeline.`}</p>
        </div>
        <Button size="sm" onClick={() => setDraft(draft && !draft.id ? null : empty())}>{draft && !draft.id ? "Cancel" : "+ New Bank"}</Button>
      </header>
      {lib.error && <div className="fc-error" role="alert">{lib.error}</div>}
      {draft && !draft.id && (
        <div className="fc-create">
          <Form draft={draft} set={setDraft} />
          <div className="acts"><Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save to account"}</Button><Button variant="quiet" size="sm" onClick={() => setDraft(null)}>Cancel</Button></div>
        </div>
      )}
      {lib.banks.length > 0 && (
        <ul className="fc-list">
          {lib.banks.map((b) => {
            const editing = draft?.id === b.id;
            return (
              <li key={b.id} className={`${b.enabled ? "on" : ""}${editing ? " editing" : ""}`}>
                <div className="line">
                  <label className="fc-switch"><input type="checkbox" checked={b.enabled} aria-label={`${b.enabled ? "Disable" : "Enable"} ${b.label}`} onChange={() => void lib.saveBank({ ...draftOf(b), id: b.id, enabled: !b.enabled })} /><span className="fc-box" aria-hidden="true" /></label>
                  <div className="body">
                    <div className="row"><b>{b.label}</b><span className="fc-chip">{b.kind}</span><span className="fc-chip">{b.scope}</span><small>{b.bankId}</small></div>
                    <p>{b.pattern.slice(0, 160)}</p>
                  </div>
                  <div className="acts">
                    <Button size="sm" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? "Hide" : "View"}</Button>
                    <Button size="sm" onClick={() => setDraft(editing ? null : draftOf(b))}>{editing ? "Cancel" : "Edit"}</Button>
                    <Button variant="danger" size="sm" onClick={() => { if (confirm === b.id) { void lib.deleteBank(b.id); setConfirm(null); setDraft(null); } else setConfirm(b.id); }}>{confirm === b.id ? "Confirm" : "Delete"}</Button>
                  </div>
                </div>
                {open === b.id && !editing && <div className="view"><ul>{b.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>{b.replace && <p><b>Replace with:</b> {b.replace}</p>}{b.why && <p><b>Why:</b> {b.why}</p>}</div>}
                {editing && draft && (
                  <div className="fc-create"><Form draft={draft} set={setDraft} />
                    <div className="acts"><Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save changes"}</Button><Button variant="quiet" size="sm" onClick={() => setDraft(null)}>Cancel</Button></div></div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
