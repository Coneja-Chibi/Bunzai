/**
 * ProtectedDialog: the one way a modal protected prompt (the lock gate, the recovery words and key flows, the Kit Gate) is drawn.
 * A native <dialog> opened with showModal() lives in the browser top layer, above every element and z-index on the page, so
 * mod CSS cannot cover it; it is portaled to the body so its only ancestors are html and body (tokens.css cancels a mod's
 * scaling of those). Escape is refused and a close it did not ask for reopens it: a gate that can be dismissed gets dismissed.
 * The inline theme manager is not modal and does not use this; the watchdog guards it instead.
 */
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./protected-dialog.module.css";

export interface ProtectedDialogProps {
  children: ReactNode;
  /** "full" fills the window behind an opaque backdrop; "card" is a centered card over a dimmed page. */
  variant: "full" | "card";
  ariaLabel?: string;
  labelledBy?: string;
  role?: "dialog" | "alertdialog";
  className?: string;
  style?: CSSProperties;
}

const noSubscription = (): (() => void) => () => undefined;

export function ProtectedDialog({ children, variant, ariaLabel, labelledBy, role, className, style }: ProtectedDialogProps): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  // false only when the markup is rendered to a string (tests): there is no top layer there, so it stays in place
  const client = useSyncExternalStore(noSubscription, () => true, () => false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    return () => { if (el.open) el.close(); };
  }, []);
  const dialog = (
    <dialog
      ref={ref}
      className={[styles.dialog, variant === "full" ? styles.full : styles.card, "host-protected", className].filter(Boolean).join(" ")}
      style={style}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); }}
      onClose={() => { const el = ref.current; if (el && !el.open) el.showModal(); }}
    >
      {children}
    </dialog>
  );
  return client ? createPortal(dialog, document.body) : dialog;
}
