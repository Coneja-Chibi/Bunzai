/**
 * The row primitives of the Messenger settings pages (wireframe messenger-discord/settings.html, rowHtml): one label-and-description block with its control at the right, or
 * under it for the wide ones. Each is controlled (value in, onChange out) and owns no state, so the section bodies in settings content stay the only place a value is read or written.
 * Clickable things are button-family parts; the rest are native inputs.
 */
import type { JSX } from "react";
import { Slider } from "../../../../components/slider";
import { Button, ListRow, Segmented, Toggle } from "../../../../components/button";


export interface RowCopy { label: string; description?: string }
export interface ChoiceOption<T extends string = string> { value: T; label: string; description?: string }
export interface PairSide<T extends string> { label: string; value: T; options: readonly ChoiceOption<T>[]; onChange(value: T): void }

function Copy({ label, description }: RowCopy): JSX.Element {
  return <div className="msn-st-t"><b>{label}</b>{description ? <span>{description}</span> : null}</div>;
}

export function ToggleRow({ label, description, on, onChange }: RowCopy & { on: boolean; onChange(on: boolean): void }): JSX.Element {
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.toggle">
      <Copy label={label} description={description} />
      <div className="msn-st-c"><Toggle on={on} onChange={onChange} aria-label={label} data-part="scene.messenger.settings.row.toggle.switch" /></div>
    </div>
  );
}

/** A value and a button ("Name shown to the model, Mina, Edit"), or just a button when there is no value. */
export function ActionRow({ label, description, value, action, onAction, variant = "secondary" }: RowCopy & { value?: string; action: string; onAction(): void; variant?: "primary" | "secondary" | "danger" }): JSX.Element {
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.action">
      <Copy label={label} description={description} />
      <div className="msn-st-c">
        {value !== undefined && <span className="msn-st-val">{value}</span>}
        <Button variant={variant} size="sm" onClick={onAction} data-part="scene.messenger.settings.row.action.button">{action}</Button>
      </div>
    </div>
  );
}

/** A row that opens a deeper page: value and chevron. */
export function DrillRow({ label, description, value, onOpen }: RowCopy & { value?: string; onOpen(): void }): JSX.Element {
  return <ListRow variant="picker" wrap label={label} subtitle={description} meta={value} onClick={onOpen} data-part="scene.messenger.settings.row.drill" />;
}

export function SelectRow<T extends string>({ label, description, value, options, onChange }: RowCopy & { value: T; options: readonly ChoiceOption<T>[]; onChange(value: T): void }): JSX.Element {
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.select">
      <Copy label={label} description={description} />
      <div className="msn-st-c">
        <select className="msn-st-sel" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export function SegmentedRow<T extends string>({ label, description, value, options, onChange }: RowCopy & { value: T; options: readonly ChoiceOption<T>[]; onChange(value: T): void }): JSX.Element {
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.segmented">
      <Copy label={label} description={description} />
      <div className="msn-st-c"><Segmented label={label} items={options.map((o) => ({ value: o.value, label: o.label }))} value={value} onChange={onChange} data-part="scene.messenger.settings.row.segmented.group" /></div>
    </div>
  );
}

export interface SliderRowProps extends RowCopy { value: number; min: number; max: number; step?: number; unit?: string; onChange(value: number): void }

export function SliderRow({ label, description, value, min, max, step = 1, unit = "", onChange }: SliderRowProps): JSX.Element {
  return (
    <div className="msn-st-r msn-st-under" data-part="scene.messenger.settings.row.slider">
      <Copy label={label} description={description} />
      <div className="msn-st-sl">
        <Slider aria-label={label} min={min} max={max} step={step} value={value} onChange={onChange} format={(v) => `${v}${unit}`} />
      </div>
    </div>
  );
}

/** A number box; an empty or half-typed box reports nothing rather than 0. */
export function NumberRow({ label, description, value, min, max, step, onChange }: RowCopy & { value: number; min?: number; max?: number; step?: number; onChange(value: number): void }): JSX.Element {
  return (
    <div className="msn-st-r" data-part="scene.messenger.settings.row.number">
      <Copy label={label} description={description} />
      <div className="msn-st-c">
        <input className="msn-st-num" type="number" aria-label={label} value={value} min={min} max={max} step={step}
          onChange={(e) => { if (e.target.value.trim() !== "" && Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber); }} />
      </div>
    </div>
  );
}

export function TextAreaRow({ label, description, value, rows = 4, onChange }: RowCopy & { value: string; rows?: number; onChange(value: string): void }): JSX.Element {
  return (
    <div className="msn-st-r msn-st-stack" data-part="scene.messenger.settings.row.textarea">
      <Copy label={label} description={description} />
      <textarea className="msn-st-ta" aria-label={label} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** One choice of a few, each with a one-line description, as cards. */
export function RadioCards<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly ChoiceOption<T>[]; onChange(value: T): void }): JSX.Element {
  return (
    <div className="msn-st-radios" role="radiogroup" aria-label={label} data-part="scene.messenger.settings.row.radios">
      {options.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (o) => (
        <ListRow key={o.value} variant="option" wrap role="radio" aria-checked={o.value === value} selected={o.value === value} label={o.label} subtitle={o.description}
          onClick={() => onChange(o.value)} data-part="scene.messenger.settings.row.radios.option" />
      ))}
    </div>
  );
}

function Side<T extends string>({ side }: { side: PairSide<T> }): JSX.Element {
  return (
    <label className="msn-st-pl">{side.label}
      <select className="msn-st-sel" value={side.value} onChange={(e) => side.onChange(e.target.value as T)}>
        {side.options.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Two labeled dropdowns side by side. */
export function PairRow<A extends string, B extends string>({ a, b }: { a: PairSide<A>; b: PairSide<B> }): JSX.Element {
  return <div className="msn-st-pair" data-part="scene.messenger.settings.row.pair"><Side side={a} /><Side side={b} /></div>;
}
