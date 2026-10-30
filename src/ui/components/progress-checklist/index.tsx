/**
 * Completion summary and shared checklist, with a compact control for editor toolbars.
 */
import { Button } from "../button";
import { useState, type JSX } from "react";
import { BottomSheet } from "../bottom-sheet";
import styles from "./styles.module.css";

export interface ProgressChecklistProps {
  /** [label, done] pairs, same shape the desktop chips receive. */
  items: ReadonlyArray<readonly [string, boolean]>;
  /** Extra stat appended to the tap chip, e.g. "Lens 18/49". */
  extraStat?: string;
  compact?: boolean;
}

/** Bar + count chip; the checklist itself lives in a bottom sheet. */
export function ProgressChecklist({ items, extraStat, compact = false }: ProgressChecklistProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const done = items.filter(([, ok]) => ok).length;
  const pct = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  return (
    <div className={compact ? styles.compact : styles.prog}>
      {!compact && <span className={styles.bar} role="progressbar" aria-label="Completion" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
        <i style={{ width: `${pct}%` }} />
      </span>}
      <Button variant={compact ? "quiet" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {`${done} of ${items.length} complete${extraStat !== undefined ? ` · ${extraStat}` : ""}`}
      </Button>
      {open && (
        <BottomSheet title={`What's done · ${done}/${items.length}`} onDismiss={() => setOpen(false)}>
          {items.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ ([label, ok]) => (
            <div key={label} className={styles.row}>
              <span className={ok ? styles.ok : styles.no} aria-hidden="true">
                {ok ? "✓" : "○"}
              </span>
              <span className={ok ? undefined : styles.pendingLabel}>{label}</span>
            </div>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
