/**
 * Focus mode - the reusable editor fullscreen (CONTRACT V2 port of the deleted _shared/focus.ts).
 * useFocusMode owns the body.focus-editor class and its Esc-to-exit (via the shared Escape arbiter); the shell's own css
 * hides the chrome (dock, top strip, tab strip) whenever that class is set, so the active pane
 * fills the window. FocusToggle is the icon button any editing surface can mount (a crumb bar, a
 * toolbar). Session-scoped by design: focus is a gesture, not a setting, so it is never persisted
 * and unmounting always exits focus - no surface can leave the shell chrome hidden behind it.
 */
import { IconButton } from "../button";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppActivity } from "../../_shared/app-activity";
import type { JSX } from "react";
import { useEscapeKey } from "../../_shared/use-escape-key";
import styles from "./styles.module.css";
import { icSvg } from "../../_shared/ic-svg";

const FOCUS_CLASS = "focus-editor";

const EXPAND_SVG = icSvg("lucide:maximize-2", 12);
const SHRINK_SVG = icSvg("lucide:minimize-2", 12);

const isFocused = (): boolean => document.body.classList.contains(FOCUS_CLASS);

/** Owns the body class + its Esc exit (through the shared arbiter, only while focused); unmounting always exits focus. */
export function useFocusMode(): { focused: boolean; toggle(): void } {
  const active = useContext(AppActivity);
  const [focused, setFocused] = useState(isFocused);

  const exit = useCallback((): void => {
    document.body.classList.remove(FOCUS_CLASS);
    setFocused(false);
  }, []);
  useEscapeKey(exit, focused && active);
  useEffect(() => { if (!active) exit(); }, [active, exit]);
  // never leave the shell chrome hidden on unmount
  useEffect(() => () => { document.body.classList.remove(FOCUS_CLASS); }, []);

  const toggle = useCallback((): void => {
    const next = !isFocused();
    document.body.classList.toggle(FOCUS_CLASS, next);
    setFocused(next);
  }, []);

  return { focused, toggle };
}

export interface FocusToggleProps {
  /** current focus state (read via useFocusMode - lifted to the caller so a room's own layout can
   * react to the same value without a second, desynced hook instance) */
  focused: boolean;
  onToggle(): void;
}

/** The expand/shrink icon button. Static first-party markup parsed via DOMParser + importNode
 * (the house rule: no innerHTML/dangerouslySetInnerHTML). Controlled: pair it with useFocusMode. */
export function FocusToggle({ focused, onToggle }: FocusToggleProps): JSX.Element {
  const iconHostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = iconHostRef.current;
    if (!host) return;
    host.replaceChildren();
    const root = new DOMParser().parseFromString(focused ? SHRINK_SVG : EXPAND_SVG, "image/svg+xml").documentElement;
    host.append(document.importNode(root, true));
  }, [focused]);

  const label = focused ? "Exit focus (Esc)" : "Focus: hide the chrome, fill the window";
  return (
    <IconButton
      size="sm"
      icon={<span ref={iconHostRef} aria-hidden="true" />}
      label={label}
      onClick={onToggle}
      aria-pressed={focused}
    />
  );
}
