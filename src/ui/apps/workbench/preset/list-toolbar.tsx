/**
 * ListToolbar - the prompt list's header (a port of RC's PromptListV4 toolbar): a search field, the
 * enabled/in-chat stats line, expand/collapse-all, and the All / Relative / In-Chat filter tabs
 * with their counts. Counts come from the WHOLE list, never the filtered view, so the badges stay
 * stable while you filter (RC does the same).
 */
import { Button, IconButton, Tabs } from "../../../components/button";
import type { JSX } from "react";
import { Ic } from "../../../_shared/ic";
import {
  PROMPT_FILTER_LABELS,
  PROMPT_FILTER_TABS,
  type PromptCounts,
  type PromptFilterTab,
} from "../../../../core/preset";
import s from "./toolbar.module.css";

export interface ListToolbarProps {
  counts: PromptCounts;
  query: string;
  onQuery: (v: string) => void;
  tab: PromptFilterTab;
  onTab: (t: PromptFilterTab) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAdd: () => void;
  onAddCategory: () => void;
}

const tabCount = (counts: PromptCounts, tab: PromptFilterTab): number =>
  tab === "all" ? counts.total : tab === "relative" ? counts.relative : counts.inchat;

export function ListToolbar({
  counts,
  query,
  onQuery,
  tab,
  onTab,
  onExpandAll,
  onCollapseAll,
  onAdd,
  onAddCategory,
}: ListToolbarProps): JSX.Element {
  return (
    <div className={s.toolbar}>
      <div className={s.topRow}>
        <div className={s.searchWrap}>
          <Ic name="lucide:search" size={14} className={s.searchIcon} />
          <input
            className={s.search}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search prompts..."
            aria-label="Search prompts"
          />
        </div>

        <span className={s.stats}>
          <b className={s.statNum}>{counts.enabled}</b> enabled · <b className={s.statNum}>{counts.inchat}</b> in-chat
        </span>

        <div className={s.actions}>
          <IconButton label="Expand all" size="sm" icon="lucide:chevrons-up-down" onClick={onExpandAll} />
          <IconButton label="Collapse all" size="sm" icon="lucide:chevrons-down-up" onClick={onCollapseAll} />
          <IconButton label="New category" size="sm" icon="lucide:folder-plus" onClick={onAddCategory} />
          <Button size="sm" icon="lucide:plus" onClick={onAdd}>Add</Button>
        </div>
      </div>

      <Tabs
        label="Filter prompts"
        items={PROMPT_FILTER_TABS.map((t) => ({
          value: t,
          label: (
            <>
              {PROMPT_FILTER_LABELS[t]}
              <span className={s.tabCount}>{tabCount(counts, t)}</span>
            </>
          ),
        }))}
        value={tab}
        onChange={onTab}
      />
    </div>
  );
}
