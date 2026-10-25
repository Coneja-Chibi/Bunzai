/**
 * Three small controls the World wing's entry editor repeats (RoleCall's NumberInput, RichTooltip's
 * "?" help button, and its on/off pill): a whole-number field that keeps what is being typed and
 * falls back to a default when it is left empty, the help square (the text rides its hover title),
 * and the 40 by 24 switch. Each is the one copy; nothing else in the wing draws these.
 */
import { useEffect, useState, type JSX } from "react";
import { ToggleSwitch } from "../../components/toggle-switch";

export function LoreNum({ value, onChange, fallback, min, max, step, float, className, label }: {
  value: number;
  onChange(n: number): void;
  /** What an emptied field becomes when it loses focus. */
  fallback: number;
  min?: number;
  max?: number;
  step?: number;
  /** A decimal, not a whole number (the boost amount). */
  float?: boolean;
  className?: string;
  label: string;
}): JSX.Element {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const parse = (v: string): number => (float ? Number.parseFloat(v) : Number.parseInt(v, 10));
  return (
    <input type="number" className={className} aria-label={label} value={text} {...(min !== undefined ? { min } : {})} {...(max !== undefined ? { max } : {})} {...(step !== undefined ? { step } : {})}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        if (Number.isNaN(parse(text))) { onChange(fallback); setText(String(fallback)); }
      }} />
  );
}

/** RoleCall's "?" help button: the title and its description ride the hover text. */
export function LoreHelp({ title, text }: { title: string; text: string }): JSX.Element {
  return <span className="wl-q" role="img" aria-label={`${title}: ${text}`} title={`${title}. ${text}`}>?</span>;
}

export function LoreSwitch({ on, onChange, label }: { on: boolean; onChange(on: boolean): void; label: string }): JSX.Element {
  return (
    <ToggleSwitch on={on} aria-label={label} title={on ? "Entry Toggle. Enabled: this entry is checked for triggers." : "Entry Toggle. Disabled: this entry is skipped during context building."} onChange={onChange} />
  );
}
