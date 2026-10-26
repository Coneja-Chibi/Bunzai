/**
 * The Messenger context menu (shell.html message menu): a list built from the button family's `MenuItem`, placed at the pointer, keyboard driven (arrows, Home, End, Enter, Esc, Right and
 * Left for a submenu) and opened by right click or a touch long press. `MenuList` is the menu itself, shared with the header's All panels menu; `ContextMenu` places it. Presentational:
 * what an item does is its own `onSelect`.
 */
import { useEffect, useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { MenuItem } from "../../../../components/button";
import { isEscapeClose } from "../../../../_shared/use-escape-key";
import type { IconName } from "../../../../_shared/ic";
import { clampToViewport, type Point, type Size } from "./popout";

export interface MenuItemSpec {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  /** a shortcut or short note at the end */
  hint?: ReactNode;
  onSelect?: () => void;
  /** a nested menu: Enter, Right or a click opens it instead of selecting */
  submenu?: MenuEntry[];
}
export interface MenuSeparator { id: string; separator: true }
export type MenuEntry = MenuItemSpec | MenuSeparator;

const isItem = (e: MenuEntry): e is MenuItemSpec => !("separator" in e);

const itemsIn = (menu: Element): HTMLElement[] => [...menu.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.getAttribute("role") === "menuitem");

export interface MenuListProps {
  items: MenuEntry[];
  label: string;
  /** called after an item without a submenu was chosen */
  onDone: () => void;
  /** Esc on the top level */
  onEscape: () => void;
  /** move focus to the first item on mount */
  autoFocus?: boolean;
}

export function MenuList({ items, label, onDone, onEscape, autoFocus = true }: MenuListProps): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState<string | null>(null);
  const subSpec = items.find((e): e is MenuItemSpec => isItem(e) && e.id === sub);

  useEffect(() => { if (autoFocus) itemsIn(wrap.current!.firstElementChild!)[0]?.focus(); }, [autoFocus]);
  useEffect(() => { if (sub) itemsIn(wrap.current!.querySelector(".msn-menu-sub")!)[0]?.focus(); }, [sub]);

  const choose = (spec: MenuItemSpec): void => {
    if (spec.submenu) { setSub(sub === spec.id ? null : spec.id); return; }
    spec.onSelect?.();
    onDone();
  };
  const closeSub = (): void => {
    const parent = sub;
    if (parent) itemsIn(wrap.current!.firstElementChild!).find((el) => el.dataset.id === parent)?.focus();
    setSub(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    const menu = target.closest('[role="menu"]');
    if (!menu) return;
    if (isEscapeClose(e.nativeEvent)) { e.preventDefault(); e.stopPropagation(); if (menu.classList.contains("msn-menu-sub")) closeSub(); else onEscape(); return; }
    const els = itemsIn(menu);
    const at = els.indexOf(target);
    const go = (i: number): void => { e.preventDefault(); els[(i + els.length) % els.length]?.focus(); };
    const inSub = menu.classList.contains("msn-menu-sub");
    switch (e.key) {
      case "ArrowDown": return go(at + 1);
      case "ArrowUp": return go(at < 0 ? -1 : at - 1);
      case "Home": return go(0);
      case "End": return go(-1);
      case "Enter": case " ": e.preventDefault(); target.click(); return;
      case "ArrowRight": if (!inSub && target.dataset.sub === "true") { e.preventDefault(); setSub(target.dataset.id!); } return;
      case "ArrowLeft": if (inSub) { e.preventDefault(); closeSub(); } return;
    }
  };

  const draw = (entries: MenuEntry[]): ReactNode => entries.map((entry) => isItem(entry)
    ? <MenuItem key={entry.id} data-part={`scene.messenger.menu.item.${entry.id}`} data-id={entry.id} data-sub={entry.submenu ? "true" : undefined} tabIndex={-1} icon={entry.icon} danger={entry.danger}
        hint={entry.submenu ? <span aria-hidden="true">{">"}</span> : entry.hint} aria-haspopup={entry.submenu ? "menu" : undefined} aria-expanded={entry.submenu ? sub === entry.id : undefined} onClick={() => choose(entry)}>{entry.label}</MenuItem>
    : <div key={entry.id} className="msn-menu-sep" role="separator" data-part="scene.messenger.menu.separator" />);

  return (
    <div ref={wrap} className="msn-menu-wrap" onKeyDown={onKeyDown}>
      <div className="msn-menu" role="menu" aria-label={label} data-part="scene.messenger.menu.list">{draw(items)}</div>
      {subSpec?.submenu && <div className="msn-menu msn-menu-sub" role="menu" aria-label={subSpec.label} data-part="scene.messenger.menu.submenu">{draw(subSpec.submenu)}</div>}
    </div>
  );
}

export interface ContextMenuProps {
  items: MenuEntry[];
  /** the pointer position the menu opens at, in viewport px */
  at: Point;
  label?: string;
  onClose: () => void;
  /** the area the menu stays inside; defaults to the window */
  bounds?: () => Size;
}

const viewportNow = (): Size => ({ w: window.innerWidth, h: window.innerHeight });

export function ContextMenu({ items, at, label = "Context menu", onClose, bounds = viewportNow }: ContextMenuProps): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Point>(at);
  useLayoutEffect(() => {
    const box = root.current;
    setPos(clampToViewport(at, { w: box?.offsetWidth || 260, h: box?.offsetHeight || 0 }, bounds()));
  }, [at, bounds, items]);
  useEffect(() => {
    const away = (e: PointerEvent): void => { if (!root.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);
  return (
    <div ref={root} className="msn-ctx" data-part="scene.messenger.menu.context" style={{ left: pos.x, top: pos.y }}>
      <MenuList items={items} label={label} onDone={onClose} onEscape={onClose} />
    </div>
  );
}

export interface ContextMenuTrigger {
  /** where the menu is open, or null */
  at: Point | null;
  close: () => void;
  /** spread onto the element that owns the menu */
  bind: {
    onContextMenu: (e: ReactMouseEvent) => void;
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
}

/** Opens a menu on right click, and on a touch held still for `holdMs` (a finger that moves more than 8px is a scroll, not a press). */
export function useContextMenuTrigger(holdMs = 500): ContextMenuTrigger {
  const [at, setAt] = useState<Point | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<Point>({ x: 0, y: 0 });
  const cancel = (): void => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => cancel, []);
  return {
    at,
    close: () => setAt(null),
    bind: {
      onContextMenu: (e) => { e.preventDefault(); cancel(); setAt({ x: e.clientX, y: e.clientY }); },
      onPointerDown: (e) => {
        if (e.pointerType !== "touch") return;
        origin.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = setTimeout(() => { timer.current = null; setAt(origin.current); }, holdMs);
      },
      onPointerMove: (e) => { if (timer.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8) cancel(); },
      onPointerUp: cancel,
      onPointerCancel: cancel,
    },
  };
}
