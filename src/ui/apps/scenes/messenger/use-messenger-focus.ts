/**
 * The Messenger's width and drawer rules (RoleCall DiscordChrome.tsx:147-151,229-280,282-303), on the studio's own Escape arbiter and focus-trap core. Under 640px the left side is a drawer that
 * keeps Tab inside itself, closes on Escape and gives focus back to its menu button. The layers (shell/surface-host.tsx, frames/layer.tsx) hold their own trap, Escape and focus return.
 * "Narrow" is the scene's own width (AGENTS rule 11), not the window's.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { focusablesIn } from "../../../_shared/focus-trap";
import { useEscapeKey } from "../../../_shared/use-escape-key";

/** At or under this width the sidebar is a drawer (discord.css @media max-width 640px, here a container query on the scene). */
export const NARROW_PX = 640;
/** Under this width the member list is a drawer over the chat and starts closed (shell.html narrow note). */
export const COMPACT_PX = 1024;

/** The scene's width in px; 0 until it is laid out (and in a DOM that lays nothing out), which callers treat as wide. */
export function useSceneWidth(shell: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const box = shell.current?.closest<HTMLElement>(".scs") ?? shell.current;
    if (!box) return undefined;
    const measure = (): void => setWidth(box.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(box);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, [shell]);
  return width;
}

export const isNarrow = (width: number): boolean => width > 0 && width <= NARROW_PX;
export const isCompact = (width: number): boolean => width > 0 && width < COMPACT_PX;

/** Tab stays inside `root`: from the last control to the first, and back. */
function trapTab(event: KeyboardEvent, root: HTMLElement): void {
  const controls = focusablesIn(root);
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) { event.preventDefault(); root.focus(); return; }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
}

function useTabTrap(root: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    if (!on) return undefined;
    const keyDown = (event: KeyboardEvent): void => {
      const box = root.current;
      const target = event.target;
      if (event.key !== "Tab" || !box || !(target instanceof HTMLElement) || !box.contains(target) || event.defaultPrevented) return;
      const nested = target.closest('[role="dialog"],dialog');
      if (nested && nested !== box) return;
      trapTab(event, box);
    };
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [root, on]);
}

export function useMessengerFocus(a: {
  left: RefObject<HTMLElement | null>; menu: RefObject<HTMLButtonElement | null>; navOpen: boolean; narrow: boolean; setNavOpen(open: boolean): void;
}): { closeNav(): void } {
  const { left, menu, navOpen, narrow, setNavOpen } = a;
  const menuRestores = useRef(false);
  const was = useRef(false);
  const live = useRef({ narrow });
  live.current = { narrow };
  useEffect(() => { if (!narrow) setNavOpen(false); }, [narrow, setNavOpen]);
  useLayoutEffect(() => {
    const wasOpen = was.current;
    was.current = navOpen;
    if (navOpen) {
      menuRestores.current = false;
      if (left.current) focusablesIn(left.current)[0]?.focus();
    } else if (wasOpen && live.current.narrow && menuRestores.current) menu.current?.focus();
  }, [navOpen, left, menu]);
  const closeNav = (): void => { menuRestores.current = true; setNavOpen(false); };
  useEscapeKey(closeNav, navOpen);
  useTabTrap(left, navOpen);
  return { closeNav };
}
