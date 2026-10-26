/**
 * The one button family (wireframe design/wireframes/features/button-family): every clickable thing in src/ui renders
 * through one of these, and rooms never style a button themselves (lint blocks a raw <button> outside this folder, the
 * style guard blocks CSS on the button element). Parts take no className or style so the look cannot drift; per-item
 * data goes through named props or `vars`. Section 1: Button, IconButton, Segmented, Tabs, DocTab, Chip. Section 2 lives
 * in rows.tsx (ListRow, MenuItem, Disclosure), surfaces.tsx (Tile, Card, Dot) and controls.tsx (Toggle, InlineValue,
 * Scrim). Every part carries data-control, the stable hook theme variants restyle.
 */
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { cx, varsStyle, type NativeButton, type Part, type Vars } from "./shared";
import styles from "./styles.module.css";
import rowStyles from "./rows.module.css";

export { ListRow, MenuItem, Disclosure, type ListRowProps, type MenuItemProps, type DisclosureProps } from "./rows";
export { Tile, Card, Dot, type TileProps, type CardProps, type DotProps } from "./surfaces";
export { Toggle, InlineValue, Scrim, type ToggleProps, type InlineValueProps, type ScrimProps } from "./controls";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "link";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends NativeButton, Part, Vars {
  children: ReactNode;
  /** primary = the one main action of the view; danger = destructive; quiet = low emphasis; link = an inline text action; secondary otherwise */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** leading icon */
  icon?: IconName;
  /** fill the parent's width */
  block?: boolean;
  /** opens a menu or picker: a trailing chevron and aria-haspopup */
  menu?: boolean;
  /** a meaning color for text, edge and a light fill, e.g. "var(--stage-warn)" for something that needs attention */
  tone?: string;
}

export function Button({ children, variant = "secondary", size = "md", icon, block, menu, tone, vars, "data-part": part, type = "button", ...rest }: ButtonProps): JSX.Element {
  return (
    <button aria-haspopup={menu ? "menu" : undefined} {...rest} type={type} data-part={part} data-control="button" data-tone={tone ? "" : undefined}
      className={cx(styles.btn, variant !== "secondary" && styles[variant], size === "sm" && styles.sm, block && styles.block)} style={varsStyle(vars, tone ? ({ "--tone": tone } as CSSProperties) : undefined)}>
      {icon && <Ic name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {menu && <Ic name="lucide:chevron-down" size={14} className={styles.chev} />}
    </button>
  );
}

export interface IconButtonProps extends NativeButton, Part, Vars {
  /** spoken name and tooltip; required because the button shows no text */
  label: string;
  icon: IconName | JSX.Element;
  variant?: Exclude<ButtonVariant, "link">;
  /** fab: the floating action (Story Director, the agent, TrackHare); its size can come from `vars` `--fab-size` */
  size?: ButtonSize | "fab";
  /** a small count or mark in the corner */
  badge?: ReactNode;
  /** a meaning color; on a quiet icon it colors only the glyph (copied, hidden, failed) */
  tone?: string;
}

export function IconButton({ label, icon, variant = "secondary", size = "md", badge, tone, vars, "data-part": part, type = "button", title, ...rest }: IconButtonProps): JSX.Element {
  const glyph = size === "sm" ? 15 : size === "fab" ? 22 : 18;
  return (
    <button {...rest} type={type} data-part={part} data-control="icon" data-tone={tone ? "" : undefined} aria-label={label} title={title ?? label}
      className={cx(styles.btn, styles.icon, variant !== "secondary" && styles[variant], size === "sm" && styles.sm, size === "fab" && styles.fab)} style={varsStyle(vars, tone ? ({ "--tone": tone } as CSSProperties) : undefined)}>
      {typeof icon === "string" ? <Ic name={icon} size={glyph} /> : icon}
      {badge !== undefined && <span className={styles.badge} data-slot="badge">{badge}</span>}
    </button>
  );
}

export interface ChoiceItem<T extends string> {
  value: T; label: ReactNode; title?: string; disabled?: boolean; "data-part"?: string;
  /** a per-option tint for its selected state, e.g. a rating grade color */
  tone?: string;
}

interface SegmentedBase<T extends string> { items: readonly ChoiceItem<T>[]; label: string; size?: ButtonSize; "data-part"?: string }
export type SegmentedProps<T extends string> = SegmentedBase<T> & (
  | { multiple?: false; value: NoInfer<T>; onChange: (value: T) => void }
  | { multiple: true; value: readonly NoInfer<T>[]; onChange: (value: T[]) => void }
);

/** Pick one (or, with multiple, several) of a few options. */
export function Segmented<T extends string>(props: SegmentedProps<T>): JSX.Element {
  const { items, label, size = "md", "data-part": part } = props;
  const isOn = (v: T): boolean => (props.multiple ? props.value.includes(v) : props.value === v);
  const pick = (v: T): void => {
    if (props.multiple) props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(v);
  };
  return (
    <div role="group" aria-label={label} data-part={part} data-control="segmented" className={cx(styles.seg, size === "sm" && styles.sm)}>
      {items.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ({ "data-part": itemPart, tone, ...item }) => (
        <button key={item.value} type="button" data-part={itemPart} aria-pressed={isOn(item.value)} title={item.title} disabled={item.disabled}
          style={tone ? ({ "--seg-tone": tone } as CSSProperties) : undefined} onClick={() => pick(item.value)}>{item.label}</button>
      ))}
    </div>
  );
}

export interface TabsProps<T extends string> {
  items: readonly ChoiceItem<T>[];
  value: NoInfer<T>;
  onChange: (value: T) => void;
  label: string;
  "data-part"?: string;
  idPrefix?: string;
  /** vertical: a rail of tabs (Messenger's icon rail); item labels may be icons, give each a `title` */
  orientation?: "horizontal" | "vertical";
}

/** Sections of one room or editor: a tablist with arrow-key movement. The caller renders the panel. */
export function Tabs<T extends string>({ items, value, onChange, label, "data-part": part, idPrefix, orientation = "horizontal" }: TabsProps<T>): JSX.Element {
  const live = items.filter((i) => !i.disabled);
  const vertical = orientation === "vertical";
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const fwd = vertical ? "ArrowDown" : "ArrowRight";
    const step = e.key === fwd ? 1 : e.key === back ? -1 : 0;
    const edge = e.key === "Home" ? live[0] : e.key === "End" ? live[live.length - 1] : undefined;
    const at = live.findIndex((i) => i.value === value);
    const next = edge ?? (step ? live[(at + step + live.length) % live.length] : undefined);
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    (e.currentTarget.querySelector(`[data-tab="${next.value}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} data-part={part} data-control="tabs" className={cx(styles.tabs, vertical && styles.vertical)} onKeyDown={onKeyDown}>
      {items.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ({ "data-part": itemPart, ...item }) => {
        const on = item.value === value;
        return (
          <button key={item.value} type="button" role="tab" data-tab={item.value} data-part={itemPart} id={idPrefix ? `${idPrefix}-tab-${item.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.value}` : undefined} aria-selected={on} tabIndex={on ? 0 : -1}
            aria-label={vertical && typeof item.label !== "string" ? item.title : undefined}
            title={item.title} disabled={item.disabled} className={styles.tab} onClick={() => onChange(item.value)}>{item.label}</button>
        );
      })}
    </div>
  );
}

export interface DocTabProps extends NativeButton, Part, Vars {
  children: ReactNode;
  /** the small kind tag after the name (SET, CHAR) */
  kind?: ReactNode;
  selected?: boolean;
  /** the top rule color, e.g. the piece's deck color */
  accent?: string;
  /** shows the close mark; called instead of selecting */
  onClose?: (e: MouseEvent<HTMLSpanElement>) => void;
  closeLabel?: string;
}

/** A document tab in the Workbench strip: selectable, closable, draggable, with a context menu (all native props pass). */
export function DocTab({ children, kind, selected, accent, onClose, closeLabel = "Close", vars, "data-part": part, type = "button", ...rest }: DocTabProps): JSX.Element {
  return (
    <button {...rest} type={type} role="tab" aria-selected={!!selected} data-part={part} data-control="doctab" data-selected={selected || undefined}
      className={styles.doctab} style={varsStyle(vars, accent ? ({ "--doctab-accent": accent } as never) : undefined)}>
      <span className={rowStyles.clip}>{children}</span>
      {kind !== undefined && <small className={styles.dockind}>{kind}</small>}
      {onClose && <span role="button" aria-label={closeLabel} title={closeLabel} className={styles.docx} onClick={(e) => { e.stopPropagation(); onClose(e); }}><Ic name="lucide:x" size={12} /></span>}
    </button>
  );
}

export interface ChipProps extends NativeButton, Part, Vars {
  children: ReactNode;
  /** on/off state; leave undefined for a plain action chip */
  pressed?: boolean;
  /** a kind color shown as a small square, e.g. "var(--deck-character)" */
  color?: string;
  /** a count shown after the label */
  count?: ReactNode;
  /** dimmed: one of a set that is not the current focus (e.g. the passes not picked) */
  muted?: boolean;
  /** a meaning color for text, edge and a light fill, e.g. "var(--stage-warn)" */
  tone?: string;
}

export function Chip({ children, pressed, color, count, muted, tone, vars, "data-part": part, type = "button", ...rest }: ChipProps): JSX.Element {
  return (
    <button {...rest} type={type} data-part={part} data-control="chip" data-muted={muted || undefined} data-tone={tone ? "" : undefined} aria-pressed={pressed} className={styles.chip}
      style={varsStyle(vars, tone ? ({ "--tone": tone } as CSSProperties) : undefined)}>
      {color && <i className={styles.dot} style={{ background: color }} aria-hidden="true" />}
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}
