/**
 * ToggleSwitch - the one on/off pill, RoleCall's: a 44x24 track with a 20px knob (SamplerPanel.tsx:166-181) or,
 * `size="sm"`, a 32x16 track with a 12px knob (LorebookPanel.tsx:3511-3527). A standalone value+onChange
 * primitive, a button with role="switch". `label` sits beside the track; `children` make it a whole-row switch
 * (text first, track at the end) so a row stays one button. `tone` re-colors the on state (default the accent).
 * Distinct from FocusToggle (an icon button) and SegControl (a 2+ segmented pick).
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import styles from "./styles.module.css";

export interface ToggleSwitchProps {
  on: boolean;
  onChange(on: boolean): void;
  /** text shown beside the switch */
  label?: string;
  /** row content shown before the track; makes the whole button the row */
  children?: ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  /** a partly-on group: announced as "mixed", the track half lit, one click turns it fully on */
  mixed?: boolean;
  /** inside a clickable row: the click stops at the switch */
  isolate?: boolean;
  /** layout only (a row's chrome); the look is the switch's */
  className?: string;
  /** the on color, a CSS color or var() */
  tone?: string;
  "aria-label"?: string;
}

export function ToggleSwitch({ on, onChange, label, children, size = "md", disabled, title, tone, mixed, isolate, className, "aria-label": ariaLabel }: ToggleSwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? "mixed" : on}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className={[styles.btn, size === "sm" ? styles.sm : "", on ? styles.on : "", mixed ? styles.mixed : "", children ? styles.row : "", className ?? ""].filter(Boolean).join(" ")}
      style={tone ? ({ "--toggle-on": tone } as CSSProperties) : undefined}
      onClick={(e) => { if (isolate) e.stopPropagation(); onChange(!on); }}
    >
      {children}
      <span className={styles.track} aria-hidden="true"><span className={styles.knob} /></span>
      {label ? <span className={styles.label}>{label}</span> : null}
    </button>
  );
}
