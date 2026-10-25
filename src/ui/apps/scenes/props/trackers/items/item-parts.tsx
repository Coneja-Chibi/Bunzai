/**
 * The parts every item tracker panel is built from (RoleCall draws each by hand in InventoryWingPanel.tsx and its siblings, with the same classes): the
 * expandable card, the filter chips, the chip row, the empty state and the module's tab strip. The card opens from its header with Enter or Space, but only
 * when the header itself has focus: RoleCall's header also reacts to a key pressed on a button inside it (a quantity button, the gear), which then toggles
 * the card as well.
 */
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Ic, type IconName } from "../../../../../_shared/ic";

export interface CardProps {
  /** The stripe and icon colour, a theme token. */
  color: string;
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  /** Left of the chevron: a quantity stepper, a level. */
  right?: ReactNode;
  /** Under the title while the card is shut: the first lines of what is in it. */
  preview?: ReactNode;
  /** Extra class names on the card (a spell that is only observed or only theory). */
  mod?: string;
  /** Beside the title: a small tag (INTERVENE). */
  chip?: ReactNode;
  /** Over the whole card, not blocking it: RoleCall's veil on an event the player has not noticed. */
  veil?: ReactNode;
  /** Under the whole header, shut or open: a strength bar. */
  under?: ReactNode;
  /** After the card's body, shut or open: the buttons RoleCall keeps outside the expander (Bonds, Memories). */
  foot?: ReactNode;
  /** The small label over the card's corner (EQUIPPED). */
  badge?: string;
  open: boolean;
  onToggle(): void;
  removed?: boolean;
  children: ReactNode;
}

export function ItemCard({ color, icon, title, meta, right, preview, under, foot, chip, veil, mod, badge, open, onToggle, removed, children }: CardProps): JSX.Element {
  const key = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onToggle();
  };
  return (
    <article className={`it-card${removed ? " gone" : ""}${mod ?? ""}`} style={{ "--c": color } as CSSProperties}>
      {veil && <div className="it-over">{veil}</div>}
      <div className="it-stripe" />
      <div className="it-head" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={key}>
        <div className="it-lead">
          <span className="it-ic">{icon}</span>
          <div className="it-title"><div className="it-titlerow"><b>{title}</b>{chip}</div>{meta && <div className="it-meta">{meta}</div>}{!open && preview && <p className="it-preview">{preview}</p>}</div>
        </div>
        <div className="it-right">{right}<Ic name={open ? "lucide:chevron-up" : "lucide:chevron-down"} size={16} /></div>
        {badge && <span className="it-badge">{badge}</span>}
      </div>
      {under && <div className="it-under">{under}</div>}
      {open && <div className="it-body">{children}</div>}
      {foot && <div className="it-foot">{foot}</div>}
    </article>
  );
}

/** A button inside a card header or body that must not also toggle the card. */
export const inner = (fn: () => void) => (e: MouseEvent): void => { e.stopPropagation(); fn(); };

/** RoleCall's +/- stepper beside a quantity. */
export function Stepper({ value, onMinus, onPlus, label }: { value: number; onMinus(): void; onPlus(): void; label: string }): JSX.Element {
  return (
    <div className="it-qty">
      <button type="button" aria-label={`Decrease ${label}`} onClick={inner(onMinus)}>-</button>
      <span>{value}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={inner(onPlus)}>+</button>
    </div>
  );
}

export function Filters<T extends string>({ options, value, onChange, icons }: { options: readonly T[]; value: T; onChange(v: T): void; icons?: Partial<Record<T, IconName>> }): JSX.Element {
  return (
    <div className="it-filters" role="group" aria-label="Filter">
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? "on" : ""} aria-pressed={value === o} onClick={() => onChange(o)}>
          {icons?.[o] && <Ic name={icons[o]!} size={14} />}<span>{o}</span>
        </button>
      ))}
    </div>
  );
}

export function Chips({ items, bad }: { items: readonly string[]; bad?: boolean }): JSX.Element | null {
  return items.length === 0 ? null : <div className="it-chips">{items.map((s, i) => <span key={`${s}${i}`} className={`it-chip${bad ? " bad" : ""}`}>{s}</span>)}</div>;
}

/** A labelled block of a card's body: a small heading over its content. */
export function Block({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return <div><h5>{title}</h5>{children}</div>;
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint: string }): JSX.Element {
  return <div className="it-empty"><Ic name={icon} size={64} /><b>{title}</b><small>{hint}</small></div>;
}

export interface TabDef<T extends string> { id: T; icon: IconName; label: string; count?: number }

/** The module's tab strip, drawn with the Stats panel's classes. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly TabDef<T>[]; value: T; onChange(v: T): void }): JSX.Element {
  return (
    <div className="st-tabs" role="tablist">
      {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={value === t.id ? "on" : ""} onClick={() => onChange(t.id)}><Ic name={t.icon} size={16} /> {t.label}{t.count !== undefined && <span className="it-count">{t.count}</span>}</button>)}
    </div>
  );
}
