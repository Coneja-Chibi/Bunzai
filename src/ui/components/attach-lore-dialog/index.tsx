/**
 * AttachLoreDialog - multi-select library lorebooks to attach as knowledgeRefs, on the InkDialog
 * seed with the letterpress row/stamp grammar. (Doctrine note, not user copy: attaching many books
 * is fine; each book's own Write-for stays single-select.)
 */
import { Button } from "../button";
import { useMemo, useState, type JSX } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { InkDialog } from "../ink-dialog";
import { VirtualRows } from "../../_shared/virtual-list";
import styles from "./styles.module.css";

const BOOK_ROW_PX = 46;

export interface AttachLoreDialogProps {
  books: readonly StudioEntitySummary[];
  alreadyLinked: readonly string[];
  onConfirm: (ids: string[]) => void;
  onDismiss: () => void;
}

export function AttachLoreDialog({
  books,
  alreadyLinked,
  onConfirm,
  onDismiss,
}: AttachLoreDialogProps): JSX.Element {
  const linked = useMemo(() => new Set(alreadyLinked), [alreadyLinked]);
  const available = books.filter((b) => b.kind === "lorebook" && !linked.has(b.id));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const toggle = (id: string): void => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = [...picked];

  return (
    <InkDialog onDismiss={onDismiss} ariaLabel="Attach lorebooks" sheetClassName={styles.sheet}>
      <div className={styles.body}>
        <span className={styles.kick}>library · lorebooks</span>
        <h2 className={styles.h}>Attach lorebooks</h2>
        <p className={styles.p}>
          Pick the books this character should know. You can reorder or detach them any time on the
          Knowledge rail.
        </p>
        {available.length === 0 ? (
          <p className={styles.empty}>Every lorebook in your Library is already attached.</p>
        ) : (
          <div className={`${styles.list} scrollThin`}>
            <VirtualRows items={available} keyOf={(b) => b.id} estimate={BOOK_ROW_PX} gap={9} render={(b) => (
              <label className={`${styles.row}${picked.has(b.id) ? ` ${styles.rowOn}` : ""}`}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={picked.has(b.id)}
                  onChange={() => toggle(b.id)}
                />
                <span className={styles.name}>{b.name || "Untitled lorebook"}</span>
              </label>
            )} />
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="quiet" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            {selected.length > 1 ? `Attach ${selected.length} books` : "Attach"}
          </Button>
        </div>
      </div>
    </InkDialog>
  );
}
