/**
 * Dual-list transfer bench for lorebook split/merge workshop (vs-lore-workshop).
 * Generic over {id,label,meta} items. Hosted in InkDialog by the caller.
 */
import { Button, IconButton, ListRow } from "../button";
import { useState, type JSX } from "react";
import styles from "./styles.module.css";

export interface TransferItem {
  id: string;
  label: string;
  meta?: string;
}

export interface TransferBenchProps {
  leftTitle: string;
  rightTitle: string;
  left: readonly TransferItem[];
  right: readonly TransferItem[];
  name: string;
  namePlaceholder?: string;
  applyLabel?: string;
  /** Apply disabled until name non-empty and right has >= 1 item (split) unless requireMoved is false. */
  requireMoved?: boolean;
  onName: (name: string) => void;
  onMoveToRight: (ids: readonly string[]) => void;
  onMoveToLeft: (ids: readonly string[]) => void;
  onReorderRight?: (id: string, dir: -1 | 1) => void;
  onApply: () => void;
  onCancel: () => void;
  busy?: boolean;
  note?: string;
}

function List({
  title,
  items,
  selected,
  onToggle,
  onSelectAll,
}: {
  title: string;
  items: readonly TransferItem[];
  selected: ReadonlySet<string>;
  onToggle: (id: string, multi: boolean) => void;
  onSelectAll: () => void;
}): JSX.Element {
  return (
    <div className={styles.col}>
      <div className={styles.colHead}>
        <b>{title}</b>
        <span className={styles.small}>
          <Button size="sm" variant="quiet" onClick={onSelectAll}>
            All
          </Button>
        </span>
      </div>
      <ul className={styles.list}>
        {items.length === 0 && <li className={styles.empty}>Empty</li>}
        {items.map((it) => {
          const on = selected.has(it.id);
          return (
            <li key={it.id}>
              <ListRow
                variant="option"
                selected={on}
                label={it.label}
                meta={it.meta || undefined}
                onClick={(ev) => onToggle(it.id, ev.ctrlKey || ev.metaKey)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TransferBench({
  leftTitle,
  rightTitle,
  left,
  right,
  name,
  namePlaceholder = "Name for the new book",
  applyLabel = "Apply",
  requireMoved = true,
  onName,
  onMoveToRight,
  onMoveToLeft,
  onReorderRight,
  onApply,
  onCancel,
  busy = false,
  note,
}: TransferBenchProps): JSX.Element {
  const [selLeft, setSelLeft] = useState<Set<string>>(() => new Set());
  const [selRight, setSelRight] = useState<Set<string>>(() => new Set());

  const toggle = (
    set: typeof setSelLeft,
    id: string,
    multi: boolean,
  ): void => {
    set((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (prev.has(id) && multi) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canApply =
    !busy && name.trim().length > 0 && (!requireMoved || right.length > 0);

  return (
    <div className={styles.wrap}>
      <label className={styles.nameRow}>
        <span>Name</span>
        <input
          value={name}
          placeholder={namePlaceholder}
          aria-label="Book name"
          onChange={(ev) => onName(ev.target.value)}
        />
      </label>
      {note && <p className={styles.note}>{note}</p>}
      <div className={styles.bench}>
        <List
          title={leftTitle}
          items={left}
          selected={selLeft}
          onToggle={(id, multi) => toggle(setSelLeft, id, multi)}
          onSelectAll={() => setSelLeft(new Set(left.map((i) => i.id)))}
        />
        <div className={styles.mid}>
          <IconButton
            size="sm"
            icon="lucide:arrow-right"
            disabled={selLeft.size === 0}
            label="Move selected to right"
            onClick={() => {
              onMoveToRight([...selLeft]);
              setSelLeft(new Set());
            }}
          />
          <IconButton
            size="sm"
            icon="lucide:arrow-left"
            disabled={selRight.size === 0}
            label="Move selected to left"
            onClick={() => {
              onMoveToLeft([...selRight]);
              setSelRight(new Set());
            }}
          />
          {onReorderRight && (
            <>
              <IconButton
                size="sm"
                icon="lucide:arrow-up"
                disabled={selRight.size !== 1}
                label="Move selected up"
                onClick={() => {
                  const id = [...selRight][0];
                  if (id) onReorderRight(id, -1);
                }}
              />
              <IconButton
                size="sm"
                icon="lucide:arrow-down"
                disabled={selRight.size !== 1}
                label="Move selected down"
                onClick={() => {
                  const id = [...selRight][0];
                  if (id) onReorderRight(id, 1);
                }}
              />
            </>
          )}
        </div>
        <List
          title={rightTitle}
          items={right}
          selected={selRight}
          onToggle={(id, multi) => toggle(setSelRight, id, multi)}
          onSelectAll={() => setSelRight(new Set(right.map((i) => i.id)))}
        />
      </div>
      <div className={styles.foot}>
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canApply} onClick={onApply}>
          {busy ? "Working…" : applyLabel}
        </Button>
      </div>
    </div>
  );
}
