/**
 * BulkBar - the selection action bar (a port of RC's PromptListV4 bulk actions). Appears only when
 * rows are checked: "N selected", Clear, then enable / disable / duplicate / delete. RC hides these
 * behind an "Actions" dropdown; there are only four, so they sit inline here rather than behind an
 * extra click. Delete is separated and styled as the destructive one.
 */
import { Button } from "../../../components/button";
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
      <Button variant="quiet" size="sm" onClick={onClear}>Clear</Button>
      <span className={s.bulkSep} />
      <Button size="sm" icon="lucide:check" onClick={onEnable}>Enable</Button>
      <Button size="sm" icon="lucide:x" onClick={onDisable}>Disable</Button>
      <Button size="sm" icon="lucide:copy" onClick={onDuplicate}>Duplicate</Button>
      <Button variant="danger" size="sm" icon="lucide:trash-2" onClick={onDelete}>Delete</Button>
    </div>
  );
}
