/**
 * The surface parts of the button family (wireframe design/wireframes/features/button-family, section 2): Tile for a
 * small square target (rail icon, color swatch, art thumb, app mark, dashed add), Card for a larger surface with its own
 * face (pick-one choice, art card, entry door, file drop), and Dot for a tiny labeled mark (pager, check, canvas port,
 * handle). Art and per-item colors pass in through props; the frame, spacing, hover and selected look are shared. Inner
 * pieces carry `data-slot` so theme variants can restyle them without counting siblings.
 */
import type { CSSProperties, DragEvent, JSX, ReactNode } from "react";
import { useState } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { cx, varsStyle, type NativeButton, type Part, type Vars } from "./shared";
import styles from "./surfaces.module.css";
import base from "./styles.module.css";

export interface TileProps extends NativeButton, Part, Vars {
  kind: "icon" | "swatch" | "thumb" | "app" | "add";
  /** spoken name, also the tooltip; for `app` it is the visible caption too */
  label: string;
  /** icon, app and add tiles */
  icon?: IconName | JSX.Element;
  /** thumb: the art (an <img>, SceneArt, initials) */
  art?: ReactNode;
  /** swatch: the color it stands for (any CSS color or var) */
  color?: string;
  selected?: boolean;
  /** a small mark in the corner (a count, a dot) */
  badge?: ReactNode;
  /** sm, md (default) or lg; fill takes the parent's size (a grid cell, a closing "New" tile) */
  size?: "sm" | "md" | "lg" | "fill";
  /** a visible caption under a swatch or thumb (an app tile always shows its label) */
  caption?: ReactNode;
}

export function Tile({ kind, label, icon, art, color, selected, badge, size = "md", caption, vars, title, "data-part": part, type = "button", ...rest }: TileProps): JSX.Element {
  const glyph = typeof icon === "string" ? <Ic name={icon} size={kind === "app" || size === "lg" ? 18 : 16} /> : icon;
  const shown = kind === "app" ? label : caption;
  return (
    <button {...rest} type={type} aria-label={kind === "app" ? undefined : label} title={title ?? label} data-part={part} data-control="tile" data-kind={kind} data-size={size} data-selected={selected || undefined}
      className={cx(styles.tile, styles[kind], shown !== undefined && styles.captioned)} style={varsStyle(vars, color ? ({ "--tile-color": color } as CSSProperties) : undefined)}>
      <span className={styles.mark} data-slot="mark">
        {kind === "thumb" ? art : kind === "add" ? (glyph ?? <Ic name="lucide:plus" size={18} />) : kind === "swatch" ? null : glyph}
      </span>
      {shown !== undefined && <span className={styles.caption} data-slot="caption">{shown}</span>}
      {badge !== undefined && <span className={base.badge} data-slot="badge">{badge}</span>}
    </button>
  );
}

export interface CardProps extends NativeButton, Part, Vars {
  kind: "choice" | "art" | "entry" | "drop";
  /** the card name (`title` stays the native tooltip) */
  heading?: ReactNode;
  /** choice: the hint under the heading; art: the line under the heading */
  subtitle?: ReactNode;
  /** art, entry and drop: the face (an image, SceneArt, a gradient; a drop card shows it once something is hung) */
  art?: ReactNode;
  /** entry: the small gold line above the heading */
  kicker?: ReactNode;
  /** anything extra under the text (a mock preview, a meta row) */
  children?: ReactNode;
  /** choice: the picked card shows the mark */
  selected?: boolean;
  /** choice: the word on the picked card (default "Picked") */
  mark?: string;
  /** the card's own tint for its frame and selected state, e.g. a deck or tone color */
  accent?: string;
  /** the one card a view leads with (a primary door): drawn in the accent */
  primary?: boolean;
  /** drop: called with the dropped files */
  onFiles?: (files: File[]) => void;
}

export function Card({ kind, heading, subtitle, art, kicker, children, selected, mark = "Picked", accent, primary, onFiles, vars, "data-part": part, type = "button", ...rest }: CardProps): JSX.Element {
  const [over, setOver] = useState(false);
  const drop = kind === "drop" && onFiles ? {
    onDragOver: (e: DragEvent<HTMLButtonElement>) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent<HTMLButtonElement>) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); },
  } : {};
  return (
    <button {...rest} {...drop} type={type} data-part={part} data-control="card" data-kind={kind} data-selected={selected || undefined} data-primary={primary || undefined} data-over={over || undefined}
      className={cx(styles.card, styles[`card_${kind}`])} style={varsStyle(vars, accent ? ({ "--card-accent": accent } as CSSProperties) : undefined)}>
      {kind === "choice" && selected && <span className={styles.markWord} data-slot="mark">{mark}</span>}
      {kind !== "choice" && art !== undefined && <span className={styles.face} data-slot="face">{art}</span>}
      {kicker !== undefined && <span className={styles.kicker} data-slot="kicker">{kicker}</span>}
      {heading !== undefined && <span className={styles.cardTitle} data-slot="heading">{heading}</span>}
      {subtitle !== undefined && <span className={styles.cardSub} data-slot="subtitle">{subtitle}</span>}
      {children}
    </button>
  );
}

export interface DotProps extends NativeButton, Part, Vars {
  /** pager: one of a set (aria-current); check: a small on/off box (aria-pressed); port: a canvas link point; handle: a drag handle */
  kind?: "pager" | "check" | "port" | "handle";
  /** spoken name, also the tooltip; required because the dot shows no text */
  label: string;
  /** pager: the current one */
  current?: boolean;
  /** check: on or off */
  pressed?: boolean;
  /** port: the link color */
  color?: string;
}

export function Dot({ kind = "pager", label, current, pressed, color, vars, title, "data-part": part, type = "button", ...rest }: DotProps): JSX.Element {
  return (
    <button {...rest} type={type} aria-label={label} title={title ?? label} aria-current={kind === "pager" ? current : undefined} aria-pressed={kind === "check" ? !!pressed : undefined}
      data-part={part} data-control="dot" data-kind={kind} className={cx(styles.dot, styles[`dot_${kind}`])} style={varsStyle(vars, color ? ({ "--dot-color": color } as CSSProperties) : undefined)}>
      {kind === "check" && pressed && <Ic name="lucide:check" size={10} />}
    </button>
  );
}
