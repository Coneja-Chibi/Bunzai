/**
 * The controls the Memory tab is made of, in RoleCall's MemoryPanel grammar (`MemoryPanel.tsx:187-292`): a field (label, hint, control), a switch row (a bordered button holding a title, a description and the
 * switch), a disclosure, and a number box that keeps what is typed and writes when you leave it. Presentational: every change goes up to the one writer.
 */
import { useState, type JSX, type ReactNode } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import { numOrNull } from "../../../../core/guards";
import { Toggle } from "../../../components/button";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <label className="mm-field">
      <span className="mm-fl">{label}</span>
      {hint ? <span className="mm-fh">{hint}</span> : null}
      {children}
    </label>
  );
}

export function SwitchRow({ title, description, checked, onChange, icon, disabled = false }: { title: string; description?: ReactNode; checked: boolean; onChange(): void; icon?: IconName; disabled?: boolean }): JSX.Element {
  return (
    <Toggle on={checked} disabled={disabled} card tone="var(--w)" onChange={onChange}>
      <span className="mm-st">
        <span className="mm-sn">{icon ? <Ic name={icon} size={14} /> : null}{title}</span>
        {description ? <span className="mm-sd">{description}</span> : null}
      </span>
    </Toggle>
  );
}

export function Disclosure({ open, onToggle, icon, title, hint, children }: { open: boolean; onToggle(open: boolean): void; icon: IconName; title: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <details className="mm-dis" open={open} onToggle={(e) => { if (e.currentTarget.open !== open) onToggle(e.currentTarget.open); }}>
      <summary>
        <span className="mm-lbl"><Ic name={icon} size={14} />{title}{hint ? <small>{hint}</small> : null}</span>
        <Ic name="lucide:chevron-down" size={16} />
      </summary>
      <div className="mm-dbody">{children}</div>
    </details>
  );
}

/** A whole-number box: what is typed stays until you leave it, then `onCommit` gets the number, or null for an empty or unusable box. */
export function NumberBox({ value, label, min, step = 1, float = false, placeholder, onCommit }: { value: number | undefined; label: string; min: number; step?: number; float?: boolean; placeholder?: string; onCommit(value: number | null): void }): JSX.Element {
  const shown = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft === null) return;
    setDraft(null);
    const next = numOrNull(float ? Number.parseFloat(draft) : Number.parseInt(draft, 10));
    if (String(next ?? "") !== shown) onCommit(next);
  };
  return (
    <input
      className="mm-in" type="number" aria-label={label} min={min} step={step} placeholder={placeholder} value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
    />
  );
}
