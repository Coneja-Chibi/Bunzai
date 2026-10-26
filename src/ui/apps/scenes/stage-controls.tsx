/**
 * The controls the Stage wing's Appearance acts are made of, in RoleCall's StageSettingsPanel grammar: a 14px label over
 * its control, 12px help under it, the slider with a caption row, the switch row (Toggle, :484), and the tile group
 * (the Auto-Scroll tiles). A control writes through `set`, which saves the preference at once; Reset writes null so the
 * value reads as the one default (stage-look-core.ts). Sliders are the house Slider.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { LOOK_KEYS, type StageLook } from "./stage-look-core";
import { Button, Segmented, Toggle } from "../../components/button";

export type LookKey = keyof typeof LOOK_KEYS;
/** What every act receives: the resolved look and the one writer. */
export interface LookProps { look: StageLook; set(key: LookKey, value: unknown): void }

/** Reset, shown once a value differs from the default (RoleCall shows it on the colour rows). */
export function ResetLink({ onClick, label = "Reset" }: { onClick(): void; label?: string }): JSX.Element {
  return <Button data-part="scene.stage.reset" variant="link" size="sm" onClick={onClick}>{label}</Button>;
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

/** the Toggle row: a tinted icon tile, the name, the switch. `tone` is the row's own token. */
export function SwitchRow({ icon, name, on, tone, help, onChange }: { icon: IconName; name: string; on: boolean; tone: string; help?: string; onChange(on: boolean): void }): JSX.Element {
  return (
    <div className="sa-sw" style={{ "--tone": tone } as CSSProperties} data-part="scene.stage.switch">
      <span className="ic"><Ic name={icon} size={16} /></span>
      <div><b>{name}</b>{help && <small>{help}</small>}</div>
      <Toggle size="sm" tone="var(--tone)" on={on} aria-label={`${on ? "Turn off" : "Turn on"} ${name.toLowerCase()}`} onChange={onChange} />
    </div>
  );
}

export function Tiles<T extends string>({ label, items, value, onPick }: { label: string; items: readonly { id: T; label: string; icon: IconName }[]; value: T; onPick(id: T): void }): JSX.Element {
  return (
    <Segmented data-part="scene.stage.tiles" label={label} items={items.map((t) => ({ value: t.id, label: <><Ic name={t.icon} size={16} />{t.label}</> }))} value={value} onChange={onPick} />
  );
}
