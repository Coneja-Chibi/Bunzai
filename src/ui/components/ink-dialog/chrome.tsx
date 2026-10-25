/** Shared title and action rows for InkDialog content sheets. */
import type { JSX } from "react";
import styles from "./chrome.module.css";

export function DialogHeader({ title, onClose }: { title: string; onClose(): void }): JSX.Element {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      <button type="button" className={styles.closeX} onClick={onClose} aria-label="Close">X</button>
    </div>
  );
}

export function DialogFooter({
  onCancel,
  onApply,
  separated = false,
}: {
  onCancel(): void;
  onApply(): void;
  separated?: boolean;
}): JSX.Element {
  return (
    <div className={`${styles.foot}${separated ? ` ${styles.separated}` : ""}`}>
      <button type="button" className={styles.btn} onClick={onCancel}>Cancel</button>
      <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={onApply}>Apply</button>
    </div>
  );
}
