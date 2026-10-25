/**
 * BulkBar - the selection action bar (a port of RC's PromptListV4 bulk actions). Appears only when
 * rows are checked: "N selected", Clear, then enable / disable / duplicate / delete. RC hides these
 * behind an "Actions" dropdown; there are only four, so they sit inline here rather than behind an
 * extra click. Delete is separated and styled as the destructive one.
 */
import type { JSX } from "react";
import { Ic } from "../../../_shared/ic";
import s from "./toolbar.module.css";

export interface BulkBarProps {
  count: number;
  onClear: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function BulkBar({ count, onClear, onEnable, onDisable, onDuplicate, onDelete }: BulkBarProps): JSX.Element | null {
  if (count === 0) return null;
  return (
    <div className={s.bulk} role="toolbar" aria-label="Bulk actions">
      <span className={s.bulkCount}>{count} selected</span>
      <button type="button" className={s.bulkBtn} onClick={onClear}>
        Clear
      </button>
      <span className={s.bulkSep} />
      <button type="button" className={s.bulkBtn} onClick={onEnable}>
        <Ic name="lucide:check" size={14} />
        Enable
      </button>
      <button type="button" className={s.bulkBtn} onClick={onDisable}>
        <Ic name="lucide:x" size={14} />
        Disable
      </button>
      <button type="button" className={s.bulkBtn} onClick={onDuplicate}>
        <Ic name="lucide:copy" size={14} />
        Duplicate
      </button>
      <button type="button" className={`${s.bulkBtn} ${s.bulkDanger}`} onClick={onDelete}>
        <Ic name="lucide:trash-2" size={14} />
        Delete
      </button>
    </div>
  );
}
