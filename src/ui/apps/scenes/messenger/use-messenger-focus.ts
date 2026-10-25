/**
 * The Messenger's keyboard and focus rules (RoleCall DiscordChrome.tsx:147-151,229-280,282-303), on the studio's own Escape arbiter and focus-trap core. The dialog and the narrow
 * drawer each keep Tab inside themselves; the dialog closes on Escape (use-escape-key.ts, so a reply is not stopped by the same press) and gives focus back to what opened it; the
 * drawer closes on Escape and gives focus back to its menu button. "Narrow" is the scene's own width (AGENTS rule 11), not the window's.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { focusablesIn } from "../../../_shared/focus-trap";
import { useDialogEscape, useEscapeKey } from "../../../_shared/use-escape-key";

/** At or under this width the sidebar is a drawer (discord.css @media max-width 640px, here a container query on the scene). */
export const NARROW_PX = 640;

/** Whether the scene is narrow; a box that has not been laid out (width 0) counts as wide. */
export function useNarrow(shell: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const box = shell.current?.closest<HTMLElement>(".scs") ?? shell.current;
    if (!box) return undefined;
    const measure = (): void => setNarrow(box.clientWidth > 0 && box.clientWidth <= NARROW_PX);
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(box);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, [shell]);
  return narrow;
}

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

const closeButton = (dialog: RefObject<HTMLElement | null>): HTMLButtonElement | null | undefined => dialog.current?.querySelector<HTMLButtonElement>("[data-msn-close]");

export function useMessengerFocus(a: {
  left: RefObject<HTMLElement | null>; dialog: RefObject<HTMLElement | null>; menu: RefObject<HTMLButtonElement | null>;
  overlayOpen: boolean; tabOpen: boolean; navOpen: boolean; narrow: boolean; closeSettings(): void; setNavOpen(open: boolean): void;
}): { remember(): void; closeNav(): void } {
  const { left, dialog, menu, overlayOpen, tabOpen, navOpen, narrow, closeSettings, setNavOpen } = a;
  const trigger = useRef<HTMLElement | null>(null);
  const menuRestores = useRef(false);
  const was = useRef(false);
  const live = useRef({ narrow, tabOpen });
  live.current = { narrow, tabOpen };
  /** What had focus when the dialog opened gets it back; a trigger inside a drawer that is gone returns to the menu button. */
  const restore = useRef((): void => undefined);
  restore.current = (): void => {
    if (trigger.current?.closest(".msn-left") && live.current.narrow) menu.current?.focus();
    else if (trigger.current?.isConnected) trigger.current.focus();
    trigger.current = null;
  };
  useLayoutEffect(() => { if (overlayOpen) closeButton(dialog)?.focus(); else restore.current(); }, [overlayOpen, dialog]);
  useEffect(() => () => restore.current(), []);
  useEffect(() => { if (!narrow) setNavOpen(false); }, [narrow, setNavOpen]);
  useLayoutEffect(() => {
    const wasOpen = was.current;
    was.current = navOpen;
    if (navOpen) {
      menuRestores.current = false;
      if (left.current) focusablesIn(left.current)[0]?.focus();
    } else if (wasOpen && !overlayOpen && live.current.narrow) {
      if (!live.current.tabOpen || menuRestores.current) menu.current?.focus();
      else closeButton(dialog)?.focus();
    }
  }, [navOpen, overlayOpen, left, menu, dialog]);
  const closeNav = (): void => { menuRestores.current = true; setNavOpen(false); };
  useEscapeKey(closeNav, navOpen);
  useDialogEscape(dialog, closeSettings, overlayOpen);
  useTabTrap(dialog, overlayOpen);
  useTabTrap(left, navOpen);
  return { remember: () => { if (!overlayOpen) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, closeNav };
}
