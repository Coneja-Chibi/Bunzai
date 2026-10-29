/** The modal boundary shared by Studio and Kit popup shells: placement, scrim, role and Escape ownership. */
import { createContext, useContext, useRef, type Context, type JSX, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogEscape } from "../../_shared/use-escape-key";
import { useFocusTrap } from "../../_shared/focus-trap";
import "./variant-styles";
import styles from "./styles.module.css";

export type DialogPlacement = "center" | "pane-bottom" | "fullscreen" | "embedded";

// Apps and shell are separate bundles. Share the context identity, as the Escape arbiter shares its owner.
const DEPTH = Symbol.for("bunzai.dialog-depth");
const contexts = globalThis as typeof globalThis & { [DEPTH]?: Context<number> };
/** Relocated app surfaces inherit their visible modal host's depth without remounting the app. */
export const DialogDepth = contexts[DEPTH] ??= createContext(0);
const PLACEMENT_Z: Record<DialogPlacement, number> = { center: 150, "pane-bottom": 120, fullscreen: 200, embedded: 60 };
export interface DialogCoreProps {
  children: ReactNode;
  placement: DialogPlacement;
  ariaLabel: string;
  onDismiss(): void;
  overlayClassName?: string;
  className?: string;
  labelledBy?: string;
  tabIndex?: number;
  as?: "div" | "section";
  sheetRef?: { current: HTMLElement | null };
  portal?: boolean;
  dismissOnScrim?: "click" | "mousedown" | false;
}

/** Shared modal shell. Visual wrappers select placement/classes and keep their own content lifecycle. */
export function DialogCore({
  children,
  placement,
  ariaLabel,
  onDismiss,
  overlayClassName,
  className,
  labelledBy,
  tabIndex,
  as = "div",
  sheetRef: suppliedRef,
  portal = false,
  dismissOnScrim = "click",
}: DialogCoreProps): JSX.Element {
  const depth = useContext(DialogDepth) + 1;
  const localRef = useRef<HTMLElement | null>(null);
  const sheetRef = suppliedRef ?? localRef;
  useDialogEscape(sheetRef, onDismiss);
  useFocusTrap(sheetRef);
  const setSheet = (element: HTMLElement | null): void => { sheetRef.current = element; };
  const onScrim = (event: MouseEvent<HTMLElement>): void => {
    if (event.target === event.currentTarget && dismissOnScrim !== false) onDismiss();
  };
  const overlay = (
    <div
      className={`${styles.overlay} ${styles[placement]}${overlayClassName ? ` ${overlayClassName}` : ""}`}
      data-dialog-overlay={placement}
      style={{ zIndex: PLACEMENT_Z[placement] + depth * 1000 }}
      onClick={dismissOnScrim === "click" ? onScrim : undefined}
      onMouseDown={dismissOnScrim === "mousedown" ? onScrim : undefined}
    >
      {as === "section" ? (
        <section
          ref={setSheet}
          className={className}
          role="dialog"
          data-dialog-sheet=""
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          tabIndex={tabIndex ?? -1}
        >
          <DialogDepth.Provider value={depth}>{children}</DialogDepth.Provider>
        </section>
      ) : (
        <div
          ref={setSheet}
          className={className}
          role="dialog"
          data-dialog-sheet=""
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          tabIndex={tabIndex ?? -1}
        >
          <DialogDepth.Provider value={depth}>{children}</DialogDepth.Provider>
        </div>
      )}
    </div>
  );
  return portal && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
