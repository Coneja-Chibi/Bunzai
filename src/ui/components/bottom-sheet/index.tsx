/**
 * BottomSheet - a sheet that slides up from the bottom edge of its pane, over a scrim.
 * The narrow-pane sibling of InkDialog (design/vs-mobile-editors.html frames 2 and 4).
 * Positions absolutely, so the hosting pane (.paneWrap) must be a positioned ancestor.
 */
import { IconButton } from "../button";
import { useRef, type JSX, type ReactNode } from "react";
import { DialogCore } from "../dialog-core";
import styles from "./styles.module.css";

export interface BottomSheetProps {
  title: string;
  ariaLabel?: string;
  onDismiss(): void;
  /** Optional control rendered at the right edge of the title row (e.g. a Select toggle). */
  titleAction?: ReactNode;
  /** Optional full-width action pinned above the sheet's bottom edge (e.g. + New entry). */
  footerAction?: ReactNode;
  children: ReactNode;
}

/** A scrim + grab-handle sheet docked to the pane's bottom; clicking the scrim dismisses. */
export function BottomSheet({ title, ariaLabel, onDismiss, titleAction, footerAction, children }: BottomSheetProps): JSX.Element {
  const sheetRef = useRef<HTMLElement | null>(null);

  return (
    <DialogCore
      placement="pane-bottom"
      onDismiss={onDismiss}
      ariaLabel={ariaLabel ?? title}
      overlayClassName={styles.overlay}
      className={styles.sheet}
      sheetRef={sheetRef}
      tabIndex={-1}
      dismissOnScrim="mousedown"
    >
      <>
        <span className={styles.grab} aria-hidden="true" />
        <div className={styles.titleRow}>
          <b className={styles.title}>{title}</b>
          {titleAction}
          <IconButton variant="quiet" size="sm" icon="lucide:x" label="Close" onClick={onDismiss} />
        </div>
        <div className={styles.body}>{children}</div>
        {footerAction !== undefined && <div className={styles.footer}>{footerAction}</div>}
      </>
    </DialogCore>
  );
}
