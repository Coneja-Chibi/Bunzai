/**
 * The small control parts of the button family (wireframe design/wireframes/features/button-family, section 2): Toggle,
 * the one on/off switch (it replaced ToggleSwitch, same props, square and from theme tokens); InlineValue, a value inside
 * text that the caller swaps for an input on click; and Scrim, the click-away layer behind a wing or menu.
 */
import type { JSX, ReactNode } from "react";
import { cx, varsStyle, type NativeButton, type Part, type Vars } from "./shared";
import styles from "./controls.module.css";

export interface ToggleProps extends Omit<NativeButton, "onChange">, Part, Vars {
  on: boolean;
  onChange(on: boolean): void;
  /** text shown beside the switch */
  label?: string;
  /** row content shown before the track; makes the whole button the row */
  children?: ReactNode;
  size?: "sm" | "md";
  /** a partly-on group: announced as "mixed", the track half lit, one click turns it fully on */
  mixed?: boolean;
  /** inside a clickable row: the click stops at the switch */
  isolate?: boolean;
  /** the on color, a CSS color or var() */
  tone?: string;
  /** a whole-row setting card: bordered, tinted when on (needs children) */
  card?: boolean;
}

export function Toggle({ on, onChange, label, children, size = "md", mixed, isolate, tone, card, vars, onClick, "data-part": part, type = "button", ...rest }: ToggleProps): JSX.Element {
  return (
    <button {...rest} type={type} role="switch" aria-checked={mixed ? "mixed" : on} data-part={part} data-control="toggle"
      className={cx(styles.toggle, size === "sm" && styles.sm, on && styles.on, mixed && styles.mixed, children !== undefined && styles.whole, card && styles.card)}
      style={varsStyle(vars, tone ? ({ "--toggle-on": tone } as never) : undefined)}
      onClick={(e) => { if (isolate) e.stopPropagation(); onClick?.(e); onChange(!on); }}>
      {children}
      <span className={styles.track} aria-hidden="true"><span className={styles.knob} /></span>
      {label ? <span data-slot="label">{label}</span> : null}
    </button>
  );
}

export interface InlineValueProps extends NativeButton, Part, Vars {
  children: ReactNode;
}

/** A value read inside prose; clicking it is the caller's cue to swap in an input. Keeps the text's own font. */
export function InlineValue({ children, vars, "data-part": part, type = "button", ...rest }: InlineValueProps): JSX.Element {
  return <button {...rest} type={type} data-part={part} data-control="inline" className={styles.inline} style={varsStyle(vars)}>{children}</button>;
}

export interface ScrimProps extends NativeButton, Part, Vars {
  /** spoken name of what the click does ("Close the wing") */
  label: string;
  /** an optional face (the paused-wing glyph and caption) */
  children?: ReactNode;
  /** no dimming: an invisible click-away (behind a small menu) */
  transparent?: boolean;
}

/** The click-away layer behind a wing, menu or sheet: covers its positioned parent; clicking it dismisses. */
export function Scrim({ label, children, transparent, vars, "data-part": part, type = "button", ...rest }: ScrimProps): JSX.Element {
  return <button {...rest} type={type} aria-label={label} data-part={part} data-control="scrim" data-transparent={transparent || undefined} className={styles.scrim} style={varsStyle(vars)}>{children}</button>;
}
