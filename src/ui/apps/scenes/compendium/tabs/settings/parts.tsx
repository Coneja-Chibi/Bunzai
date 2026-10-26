/**
 * The Settings tab's small parts, one copy each: the section card, a labelled row, RoleCall's switch, stepper and segmented row
 * (`CompendiumSettings.tsx:95-356`). Presentational; what a change does is the caller's. Styles are in settings-style.ts.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Slider } from "../../../../../components/slider";
import { IconButton, Segmented, Toggle } from "../../../../../components/button";

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
  return <Toggle on={on} onChange={onChange} tone="var(--cpa)" aria-label={label} />;
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
        <IconButton size="sm" label={`${label}: one less`} icon="lucide:minus" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} />
        <output>{value}</output>
        <IconButton size="sm" label={`${label}: one more`} icon="lucide:plus" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} />
      </div>
    </SettingsField>
  );
}

export function SettingsSegmented<T extends string>({ label, hint, value, options, onChange }: { label: string; hint?: string; value: T; options: readonly { value: T; label: string }[]; onChange(v: T): void }): JSX.Element {
  return (
    <SettingsField label={label} {...(hint ? { hint } : {})}>
      <div className="cps-seg"><Segmented label={label} value={value} onChange={onChange} items={options} /></div>
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
