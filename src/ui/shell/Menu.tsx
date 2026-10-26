/**
 * Menu - the one right-click renderer for the whole app (transcribed 1:1 from
 * src/ui/_shared/context-menu.ts's `show`/document-listener behavior, store-driven per CONTRACT
 * V2). Mounted once at the shell root. Owns the document-level listeners: `contextmenu` resolves
 * the target and shows the menu (deny by absence at every step), `click` away and `Escape` close
 * it, `blur`/`resize` close it too. The menu itself renders from `openMenu` alone - no imperative
 * DOM building, unlike the vanilla version this replaces.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { JSX } from "react";
import { MenuItem } from "../components/button";
import { findMenuTarget, menuSectionsFor, useShellStore } from "./store";
import { isEscapeClose, useEscapeKey } from "../_shared/use-escape-key";

export function Menu(): JSX.Element | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const openMenu = useShellStore((s) => s.openMenu);
  const showMenu = useShellStore((s) => s.showMenu);
  const closeMenu = useShellStore((s) => s.closeMenu);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEscapeKey(closeMenu, openMenu !== null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent): void => {
      const target = findMenuTarget(e.target);
      if (!target) return; // nothing attached anywhere up the tree: let the browser have it
      const sections = menuSectionsFor(target);
      if (sections.length === 0) return; // no provider spoke: deny by absence, browser menu stands
      e.preventDefault();
      setContainer(e.target instanceof Element ? e.target.closest<HTMLElement>('[role="dialog"]') : null);
      showMenu(e.clientX, e.clientY, target, sections);
    };
    const onClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClick);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("click", onClick);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [showMenu, closeMenu]);

  // clamp into the viewport once the menu has real dimensions (mirrors the vanilla getBoundingClientRect clamp)
  useLayoutEffect(() => {
    if (!openMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const r = menuRef.current.getBoundingClientRect();
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    setPos({
      left: Math.min(openMenu.x, window.innerWidth - r.width - 8),
      top: Math.min(openMenu.y, window.innerHeight - r.height - 8),
    });
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [openMenu]);

  if (!openMenu) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="vmenu"
      role="menu"
      style={pos ? { left: pos.left, top: pos.top } : { left: openMenu.x, top: openMenu.y }}
      onKeyDown={(e) => {
        if (isEscapeClose(e.nativeEvent)) { e.preventDefault(); e.stopPropagation(); closeMenu(); }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        e.preventDefault(); buttons[(at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}
    >
      <div className="hd">{openMenu.target.label}</div>
      {openMenu.sections.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (section, i) => (
        <div key={i}>
          {i > 0 && <div className="sep" />}
          {section.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (item, j) => (
            <MenuItem
              key={j}
              danger={item.danger}
              disabled={item.disabled}
              onClick={() => {
                closeMenu();
                item.onPick();
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </div>
      ))}
    </div>, container?.isConnected ? container : document.body,
  );
}
