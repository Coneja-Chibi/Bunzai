/**
 * The small controls every Final Cut card is made of (RoleCall's PostProductionPanel.module.css label, select, textarea, checkRow and
 * PassRangeCard): a labelled select over an option table, a checkbox row, a range with its readout and footer, and a text area. One
 * place, so a card never draws its own.
 */
import type { JSX } from "react";
import { Slider } from "../../../components/slider";

export type Options = Readonly<Record<string, { label: string }>>;

export function Sel({ label, value, options, onChange }: { label: string; value: string; options: Options; onChange(next: string): void }): JSX.Element {
  return (
    <label className="fc-label">{label}
      <select className="fc-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(next: boolean): void }): JSX.Element {
  return (
    <label className="fc-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="fc-box" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function Range({ label, value, min, max, step, display, footer, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; footer?: string | undefined; onChange(next: number): void }): JSX.Element {
  return (
    <div className="fc-range">
      <div className="head"><span>{label}</span><b>{display}</b></div>
      <Slider readout={false} aria-label={label} min={min} max={max} step={step} value={value} color="var(--p,var(--w))" onChange={onChange} />
      {footer && <small>{footer}</small>}
    </div>
  );
}

export function Area({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange(next: string): void }): JSX.Element {
  return (
    <label className="fc-label">{label}
      <textarea className="fc-area" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Line({ label, value, onChange }: { label: string; value: string; onChange(next: string): void }): JSX.Element {
  return (
    <label className="fc-label">{label}
      <input className="fc-field" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
