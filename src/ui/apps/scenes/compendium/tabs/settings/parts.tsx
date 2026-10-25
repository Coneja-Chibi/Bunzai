/**
 * The Settings tab's small parts, one copy each: the section card, a labelled row, RoleCall's switch, stepper and segmented row
 * (`CompendiumSettings.tsx:95-356`). Presentational; what a change does is the caller's. Styles are in settings-style.ts.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Slider } from "../../../../../components/slider";
import { ToggleSwitch } from "../../../../../components/toggle-switch";

export function SettingsSection({ id, title, blurb, dot, children }: { id: string; title: string; blurb?: string; dot?: string; children: ReactNode }): JSX.Element {
  return (
    <section className="cps-sec" data-part={`compendium.settings.${id}`} style={dot ? ({ "--dot": dot } as CSSProperties) : undefined}>
      <h3><i />{title}</h3>
      {blurb && <p>{blurb}</p>}
      <div className="cps-body">{children}</div>
    </section>
  );
}

export function SettingsField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <span className="cps-lab">{label}</span>
      {hint && <p className="cps-hint">{hint}</p>}
      {children}
    </div>
  );
}

export function SettingsSwitch({ on, onChange, label }: { on: boolean; onChange(on: boolean): void; label: string }): JSX.Element {
  return <ToggleSwitch on={on} onChange={onChange} tone="var(--cpa)" aria-label={label} />;
}

export function SettingsToggle({ on, onChange, label, hint }: { on: boolean; onChange(on: boolean): void; label: string; hint?: string }): JSX.Element {
  return (
    <div className="cps-tg">
      <SettingsSwitch on={on} onChange={onChange} label={label} />
      <div>
        <span className="cps-lab">{label}</span>
        {hint && <p className="cps-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function SettingsStepper({ label, hint, value, min, max, step = 1, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange(n: number): void }): JSX.Element {
  return (
    <SettingsField label={label} {...(hint ? { hint } : {})}>
      <div className="cps-step" role="group" aria-label={label}>
        <button type="button" aria-label={`${label}: one less`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>-</button>
        <output>{value}</output>
        <button type="button" aria-label={`${label}: one more`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </SettingsField>
  );
}

export function SettingsSegmented<T extends string>({ label, hint, value, options, onChange }: { label: string; hint?: string; value: T; options: readonly { value: T; label: string }[]; onChange(v: T): void }): JSX.Element {
  return (
    <SettingsField label={label} {...(hint ? { hint } : {})}>
      <div className="cps-seg" role="group" aria-label={label}>
        {options.map((o) => <button type="button" key={o.value} aria-pressed={o.value === value} className={o.value === value ? "on" : undefined} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    </SettingsField>
  );
}

/** RoleCall's range slider (`RangeSlider`): a labelled range with its value shown. */
export function SettingsRange({ label, hint, value, min, max, step, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step: number; onChange(n: number): void }): JSX.Element {
  return (
    <SettingsField label={label} {...(hint ? { hint } : {})}>
      <div className="cps-range">
        <Slider readout={false} aria-label={label} min={min} max={max} step={step} value={value} onChange={onChange} />
        <output>{value.toLocaleString()}</output>
      </div>
    </SettingsField>
  );
}
