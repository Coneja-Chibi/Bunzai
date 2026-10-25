/**
 * InkDialog - the modal overlay + ink-bordered sheet (transcribed 1:1 from src/ui/index.html's
 * .vdialog-overlay / .vdialog rules: dark scrim, centered sheet, 3px ink border, 6px hard offset
 * shadow). The shell's follow dialog (boot.ts's askFollow) is the reference instance this replaces.
 */
import type { JSX, ReactNode } from "react";
import { DialogCore } from "../dialog-core";
import styles from "./styles.module.css";

export interface InkDialogProps {
  children: ReactNode;
  /** fires on a click on the scrim itself (not a click bubbling up from the sheet) */
  onDismiss: () => void;
  ariaLabel: string;
  /** extra class on the sheet (e.g. "vdialog" so a consumer's existing global descendant rules,
   * like ".vdialog .actions button", keep applying without this seed knowing their names) */
  sheetClassName?: string;
}

/** A centered modal sheet over a dark scrim; clicking the scrim or pressing Escape calls onDismiss. */
export function InkDialog({ children, onDismiss, ariaLabel, sheetClassName }: InkDialogProps): JSX.Element {
  // Portal to the body: rendered inline, the fixed overlay is trapped inside whatever stacking
  // context its ancestor editor card creates, and page chrome paints THROUGH the modal.
  return (
    <DialogCore
      placement="center"
      portal
      onDismiss={onDismiss}
      ariaLabel={ariaLabel}
      overlayClassName={styles.overlay}
      className={sheetClassName ? `${styles.sheet} ${sheetClassName}` : styles.sheet}
      dismissOnScrim="click"
    >
      {children}
    </DialogCore>
  );
}
