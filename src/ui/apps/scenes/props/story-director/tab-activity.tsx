/**
 * The Activity tab (RoleCall's ActivityTab, StoryDirectorWingPanel.tsx:1323-1468): filters (All, Turns, Tools, Planning), the entry count, a clear button, and the feed newest first with
 * one line open at a time. NEW against RoleCall: the feed is part of the saved story (the last 200 lines), so it is still here after a reload; Clear hides, it does not delete.
 */
import { useState, type JSX } from "react";
import { IconButton, Segmented } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import type { DirectorActivity } from "../../../../../stage/contracts/director-types";
import { ACTIVITY_FILTERS, activityNewestFirst, type ActivityFilter } from "./director-core";
import { ActivityLine } from "./director-parts";

export function ActivityTab({ entries, now, onClear, locked }: { entries: readonly DirectorActivity[]; now: number; onClear(): void; locked: boolean }): JSX.Element {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const shown = activityNewestFirst(entries, filter);
  return (
    <div className="dr-activity" data-part="scene.director.activity">
      <div className="dr-filters">
        <Segmented size="sm" label="Activity filter" items={ACTIVITY_FILTERS.map((f) => ({ value: f.id, label: f.label }))} value={filter} onChange={setFilter} />
        <span className="dr-filters-r">
          <small>{shown.length} entries</small>
          {entries.length > 0 && <IconButton variant="danger" size="sm" label="Clear activity log" icon="lucide:trash-2" disabled={locked} onClick={onClear} />}
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="dr-quiet short"><Ic name="lucide:activity" size={32} /><p>No activity yet</p><small>Send a message to see DM activity</small></div>
      ) : (
        <div className="dr-feed">{shown.map((e) => <ActivityLine key={e.id} entry={e} now={now} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />)}</div>
      )}
    </div>
  );
}
