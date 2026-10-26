/**
 * The row parts of the button family (wireframe design/wireframes/features/button-family, section 2): ListRow for a
 * full-width row in a list, rail or picker; MenuItem for a row inside a popup menu; Disclosure for a header that opens
 * and closes a section. One look each; the caller supplies content through slots, never a className.
 */
import type { JSX, ReactNode } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { cx, varsStyle, type NativeButton, type Part, type Vars } from "./shared";
import styles from "./rows.module.css";

export interface ListRowProps extends NativeButton, Part, Vars {
  /** the main line */
  label: ReactNode;
  /** a second, dimmer line */
  subtitle?: ReactNode;
  /** an icon, initials tile or avatar before the text */
  leading?: ReactNode;
  /** a count or short fact at the end */
  meta?: ReactNode;
  /** a control or mark after the meta (kept inside the row's click) */
  trailing?: ReactNode;
  /** option: a tick box that shows `selected`; tree: indented by `depth`; picker: a trailing chevron (opens a choice) */
  variant?: "plain" | "option" | "tree" | "picker";
  /** the chosen, current or on row; the caller sets the matching aria attribute */
  selected?: boolean;
  depth?: number;
  /** a per-row tint for the selected bar, e.g. a deck color */
  accent?: string;
  /** let the label and subtitle wrap onto more lines instead of truncating */
  wrap?: boolean;
}

export function ListRow({ label, subtitle, leading, meta, trailing, variant = "plain", selected, depth = 0, accent, wrap, vars, "data-part": part, type = "button", ...rest }: ListRowProps): JSX.Element {
  return (
    <button {...rest} type={type} data-part={part} data-control="row" data-selected={selected || undefined} data-wrap={wrap || undefined}
      className={styles.row} style={varsStyle(vars, { ...(accent ? { "--row-accent": accent } : {}), ...(depth ? { "--row-depth": String(depth) } : {}) } as never)}>
      {variant === "option" ? <span className={styles.tick} data-slot="tick" aria-hidden="true">{selected && <Ic name="lucide:check" size={12} />}</span> : leading !== undefined && <span className={styles.lead} data-slot="leading">{leading}</span>}
      <span className={styles.text}><span className={styles.clip} data-slot="label">{label}</span>{subtitle !== undefined && <small className={styles.sub} data-slot="subtitle">{subtitle}</small>}</span>
      {(meta !== undefined || trailing !== undefined || variant === "picker") && (
        <span className={styles.meta} data-slot="meta">{meta}{trailing}{variant === "picker" && <Ic name="lucide:chevron-right" size={14} />}</span>
      )}
    </button>
  );
}

export interface MenuItemProps extends NativeButton, Part, Vars {
  children: ReactNode;
  icon?: IconName | JSX.Element;
  /** a shortcut or short note at the end */
  hint?: ReactNode;
  danger?: boolean;
  /** a checkable item: pass with role="menuitemradio" or "menuitemcheckbox"; shows a tick when true */
  checked?: boolean;
  /** a second, dimmer line under the label */
  description?: ReactNode;
  /** a per-item tint for the icon and hover, e.g. a mode or deck color */
  accent?: string;
}

export function MenuItem({ children, icon, hint, danger, checked, description, accent, vars, "data-part": part, type = "button", role = "menuitem", ...rest }: MenuItemProps): JSX.Element {
  const checkable = checked !== undefined;
  return (
    <button {...rest} type={type} role={role} aria-checked={checkable ? checked : undefined} data-part={part} data-control="menuitem" data-tone={danger ? "danger" : undefined}
      className={cx(styles.item, danger && styles.danger)} style={varsStyle(vars, accent ? ({ "--item-accent": accent } as never) : undefined)}>
      <span className={styles.icon} aria-hidden="true">
        {checkable ? (checked && <Ic name="lucide:check" size={14} />) : typeof icon === "string" ? <Ic name={icon} size={14} /> : icon}
      </span>
      <span className={cx(styles.label, styles.clip)} data-slot="label">{children}{description !== undefined && <small className={styles.desc} data-slot="description">{description}</small>}</span>
      {hint !== undefined && <small className={styles.hint}>{hint}</small>}
    </button>
  );
}

export interface DisclosureProps extends NativeButton, Part, Vars {
  open: boolean;
  label: ReactNode;
  /** a short summary of the section, shown at the end */
  summary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** section: a bold header; line: a quiet text fold ("Show the rehearsal") */
  variant?: "section" | "line";
  depth?: number;
  /** false hides the chevron (the open state still announces through aria-expanded) */
  chevron?: boolean;
}

export function Disclosure({ open, label, summary, leading, trailing, variant = "section", depth = 0, chevron = true, vars, "data-part": part, type = "button", ...rest }: DisclosureProps): JSX.Element {
  return (
    <button {...rest} type={type} aria-expanded={open} data-part={part} data-control="disclosure"
      className={cx(styles.fold, variant === "line" && styles.line)} style={varsStyle(vars, depth ? ({ "--row-depth": String(depth) } as never) : undefined)}>
      {chevron && <Ic name="lucide:chevron-right" size={14} className={styles.chev} />}
      {leading}
      <span className={cx(styles.foldTitle, styles.clip)} data-slot="label">{label}</span>
      {(summary !== undefined || trailing !== undefined) && <span className={styles.meta} data-slot="meta">{summary !== undefined && <small className={styles.sub}>{summary}</small>}{trailing}</span>}
    </button>
  );
}
