/**
 * The controls the Stage wing's Appearance acts are made of, in RoleCall's StageSettingsPanel grammar: a 14px label over
 * its control, 12px help under it, the slider with a caption row, the switch row (ToggleSwitch, :484), and the tile group
 * (the Auto-Scroll tiles). A control writes through `set`, which saves the preference at once; Reset writes null so the
 * value reads as the one default (stage-look-core.ts). Sliders are the house Slider.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { LOOK_KEYS, type StageLook } from "./stage-look-core";
import { ToggleSwitch } from "../../components/toggle-switch";

export type LookKey = keyof typeof LOOK_KEYS;
/** What every act receives: the resolved look and the one writer. */
export interface LookProps { look: StageLook; set(key: LookKey, value: unknown): void }

/** Reset, shown once a value differs from the default (RoleCall shows it on the colour rows). */
export function ResetLink({ onClick, label = "Reset" }: { onClick(): void; label?: string }): JSX.Element {
  return <button type="button" className="sa-reset" onClick={onClick}>{label}</button>;
}

export function Field({ icon, label, help, children }: { icon: IconName; label: string; help?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="sa-field" data-part="scene.stage.field">
      <span className="sa-lbl"><Ic name={icon} size={14} />{label}</span>
      {children}
      {help && <p className="sa-help">{help}</p>}
    </div>
  );
}

export function SliderField({ icon, label, caption, value, limits, format, help, changed, onChange, onReset }: {
  icon: IconName; label: string; caption: string; value: number; limits: readonly [number, number, number]; format(v: number): string; help: string; changed: boolean; onChange(v: number): void; onReset(): void;
}): JSX.Element {
  return (
    <Field icon={icon} label={label} help={help}>
      <div className="sa-cap"><span>{caption}</span>{changed && <ResetLink onClick={onReset} />}</div>
      <Slider value={value} min={limits[0]} max={limits[1]} step={limits[2]} format={format} onChange={onChange} aria-label={label} />
    </Field>
  );
}

/** RoleCall's ToggleSwitch row: a tinted icon tile, the name, the switch. `tone` is the row's own token. */
export function SwitchRow({ icon, name, on, tone, help, onChange }: { icon: IconName; name: string; on: boolean; tone: string; help?: string; onChange(on: boolean): void }): JSX.Element {
  return (
    <div className="sa-sw" style={{ "--tone": tone } as CSSProperties} data-part="scene.stage.switch">
      <span className="ic"><Ic name={icon} size={16} /></span>
      <div><b>{name}</b>{help && <small>{help}</small>}</div>
      <ToggleSwitch size="sm" tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} ${name.toLowerCase()}`} onChange={onChange} />
    </div>
  );
}

export function Tiles<T extends string>({ label, items, value, onPick }: { label: string; items: readonly { id: T; label: string; icon: IconName }[]; value: T; onPick(id: T): void }): JSX.Element {
  return (
    <div className="sa-tiles" role="group" aria-label={label} data-part="scene.stage.tiles">
      {items.map((t) => (
        <button type="button" key={t.id} className={`sa-tile${value === t.id ? " on" : ""}`} aria-pressed={value === t.id} onClick={() => onPick(t.id)}>
          <Ic name={t.icon} size={16} /><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
