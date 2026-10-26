/**
 * ProgressChecklist - the narrow-pane form of the editor's done-chips: one bar plus a count
 * chip; tapping opens a BottomSheet checklist (design/vs-mobile-editors.html frame 2).
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
}

/** Bar + count chip; the checklist itself lives in a bottom sheet. */
export function ProgressChecklist({ items, extraStat }: ProgressChecklistProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const done = items.filter(([, ok]) => ok).length;
  const pct = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  return (
    <div className={styles.prog}>
      <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <Button size="sm" onClick={() => setOpen(true)}>
        {`${done}/${items.length} done${extraStat !== undefined ? ` · ${extraStat}` : ""}`}
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
