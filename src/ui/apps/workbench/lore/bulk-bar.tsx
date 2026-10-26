/**
 * Floating bulk action bar for the lore TOC select mode (vs-lore-page-2).
 * Delete is destructive: an InkDialog confirm sheet gates it (no bare browser confirm).
 */
import { Button, IconButton } from "../../../components/button";
import { useState } from "react";
import type { JSX } from "react";
import { InkDialog } from "../../../components/ink-dialog";

export interface BulkBarProps {
  count: number;
  styles: Readonly<Record<string, string>>;
  onEnable: (on: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
  onMove?: () => void;
}

export function LoreBulkBar({
  count,
  styles,
  onEnable,
  onDelete,
  onClear,
  onMove,
}: BulkBarProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className={styles.bulkBar} role="toolbar" aria-label="Bulk entry actions">
        <div className={styles.bTop}>
          <b>
            {count} selected
          </b>
          <IconButton label="Clear selection" variant="quiet" size="sm" icon="lucide:x" onClick={onClear} />
        </div>
        <div className={styles.bActs}>
          <Button size="sm" onClick={() => onEnable(true)}>On</Button>
          <Button size="sm" onClick={() => onEnable(false)}>Off</Button>
          <Button
            size="sm"
            disabled={!onMove}
            title={onMove ? "Split selected entries into a new book" : "Move unavailable"}
            onClick={() => onMove?.()}
          >
            Move…
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>Delete</Button>
        </div>
      </div>

      {confirmOpen && (
        <InkDialog onDismiss={() => setConfirmOpen(false)} ariaLabel="Delete entries">
          <div className={styles.bcSheet}>
            <b className={styles.bcTitle}>
              Delete {count} {count === 1 ? "entry" : "entries"}?
            </b>
            <p className={styles.bcBody}>There is no undo.</p>
            <div className={styles.bcActs}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setConfirmOpen(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setConfirmOpen(false)}>Keep</Button>
            </div>
          </div>
        </InkDialog>
      )}
    </>
  );
}
