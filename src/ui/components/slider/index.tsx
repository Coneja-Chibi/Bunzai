/**
 * Slider - the one range control: RoleCall's .slider-dark track and thumb with the filled portion, and, when
 * asked, its sampler card (PresetPanel.tsx SamplerSlider, 2859-3030): a label, the colored readout you click
 * to type into (Enter or blur commits once, Escape cancels, the value is clamped and snapped to the step),
 * and a "?" that opens the help text. It is a value + onChange primitive that commits on every change, so a
 * keyboard step lands; callers coalesce their own writes. Without a label it is the bare styled range, with
 * the readout beside it unless `readout={false}`. Every other prop lands on the range input itself.
 */
import { IconButton, InlineValue } from "../button";
import { useRef, useState, type CSSProperties, type InputHTMLAttributes, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import "../rc-controls/rc-reset.css";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { fillPercent, formatReadout, snapToStep } from "./slider-core";
import styles from "./styles.module.css";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step" | "color"> {
  value?: number | undefined;
  /** Uncontrolled start value (a caller that paints its own live preview and must not re-render per tick). */
  defaultValue?: number | undefined;
  min: number;
  max: number;
  step?: number;
  onChange?(value: number): void;
  /** readout formatter (default: RoleCall's 8.2K / step decimals) */
  format?(value: number): string;
  /** a label turns the slider into RoleCall's card */
  label?: string;
  /** the text behind the "?" toggle (card only) */
  help?: string;
  /** thumb, fill and readout color; defaults to the accent */
  color?: string;
  /** show the value (default true); false when the caller draws its own */
  readout?: boolean;
}

export function Slider({ value, defaultValue, min, max, step = 1, onChange, format, label, help, color, readout = true, style, onInput, ...rest }: SliderProps): JSX.Element {
  const [showHelp, setShowHelp] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const editing = useRef(false);
  const controlled = value !== undefined;
  const cur = value ?? defaultValue ?? min;
  const show = format ?? ((v: number) => formatReadout(v, step));
  const editable = controlled && !!onChange && !rest.disabled && readout;
  const name = rest["aria-label"] ?? label;
  const tone = color ? ({ "--slider-color": color } as CSSProperties) : undefined;

  const finish = (commit: boolean): void => {
    if (!editing.current) return;
    editing.current = false;
    const next = parseFloat(draft ?? "");
    setDraft(null);
    if (commit && Number.isFinite(next)) onChange?.(snapToStep(next, min, max, step));
  };

  const input = (
    <input
      {...rest}
      type="range"
      className={styles.range}
      min={min}
      max={max}
      step={step}
      {...(controlled ? { value } : { defaultValue })}
      aria-label={name}
      style={{ "--slider-p": `${fillPercent(cur, min, max)}%`, ...tone, ...style } as CSSProperties}
      onChange={(e) => onChange?.(Number(e.target.value))}
      onInput={(e) => {
        if (!controlled) e.currentTarget.style.setProperty("--slider-p", `${fillPercent(Number(e.currentTarget.value), min, max)}%`);
        onInput?.(e);
      }}
    />
  );
  if (!label && !readout) return input;

  const shown = draft === null ? (
    editable ? (
      <InlineValue title="Click to type a value" onClick={() => { editing.current = true; setDraft(String(cur)); }}>{show(cur)}</InlineValue>
    ) : (
      <span className={styles.value} data-static="">{show(cur)}</span>
    )
  ) : (
    <input
      type="number"
      className={styles.typed}
      aria-label={`${name ?? "Slider"} value`}
      autoFocus
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        else if (isEscapeClose(e.nativeEvent)) finish(false);
      }}
    />
  );

  if (!label) return <div className={styles.wrap} style={tone}>{input}{shown}</div>;
  return (
    <div className={styles.card} style={tone} data-disabled={rest.disabled ? "" : undefined}>
      <div className={styles.head}>
        <span className={styles.label}>
          {label}
          {help && (
            <IconButton variant="quiet" size="sm" icon="lucide:circle-question-mark" label={`About ${label}`} aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)} />
          )}
        </span>
        {readout && shown}
      </div>
      {showHelp && help && <div className={styles.help}>{help}</div>}
      {input}
    </div>
  );
}
