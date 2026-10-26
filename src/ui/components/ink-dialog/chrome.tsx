/** Shared title and action rows for InkDialog content sheets. */
import { Button, IconButton } from "../button";
import type { JSX } from "react";
import styles from "./chrome.module.css";

export function DialogHeader({ title, onClose }: { title: string; onClose(): void }): JSX.Element {
  return (
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      <IconButton variant="quiet" size="sm" icon="lucide:x" label="Close" onClick={onClose} />
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
      <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onApply}>Apply</Button>
    </div>
  );
}
