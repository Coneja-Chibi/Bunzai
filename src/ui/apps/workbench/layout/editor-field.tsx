/**
 * EditorField - one labelled field of an editor section. The label, control, hint and optional meter are the same
 * five parts in every `editor.fields` variant (labeled-rows, stat-sheet, cards, form-on-paper); the variant's
 * stylesheet arranges them, and stat-sheet alone adds the meter for a numeric field. The control and its handlers
 * belong to the caller; this only labels and places them.
 */
import { useId, type JSX, type ReactNode } from "react";
import { useSurfaceVariant } from "../../../_shared/surface-variant";
import es from "../editor-styles";
import { meterPercent, type FieldMeter } from "./editor-layout-core";
import s from "./editor-layout.module.css";

export interface EditorFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  /** id of the single control to label; omit when the field holds several controls (it is then a labelled group) */
  htmlFor?: string;
  /** a numeric field's range: stat-sheet draws it as a meter under the value */
  meter?: FieldMeter;
  /** spans the full row in the multi-column variants (long text, panels) */
  wide?: boolean;
  children: ReactNode;
}

export function EditorField({ label, hint, required, htmlFor, meter, wide, children }: EditorFieldProps): JSX.Element {
  const id = useId();
  const fields = useSurfaceVariant("editor.fields");
  const text = <>{label}{required && <span aria-hidden="true"> *</span>}</>;
  return (
    <div className={es.bfield} data-ef="field" data-part="editor.field" data-wide={wide ? "" : undefined} role={htmlFor ? undefined : "group"} aria-labelledby={htmlFor ? undefined : id}>
      {htmlFor ? <label id={id} htmlFor={htmlFor} className={es.blabel} data-ef="label">{text}</label> : <span id={id} className={es.blabel} data-ef="label">{text}</span>}
      <div data-ef="control">
        {children}
        {meter && fields === "stat-sheet" && (
          <div role="meter" aria-label={label} aria-valuemin={meter.min} aria-valuemax={meter.max} aria-valuenow={meter.value} data-ef="meter">
            <i style={{ width: `${meterPercent(meter)}%` }} />
          </div>
        )}
      </div>
      {hint && <span className={s.hint} data-ef="hint">{hint}</span>}
    </div>
  );
}
