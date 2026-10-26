/**
 * BlockList - the prompt list (RC PromptListV4 port), VIRTUALIZED (without windowing, 1,000-3,000 blocks
 * cost 17-51k DOM nodes and 143-675ms keystroke latency). `@tanstack/react-virtual` via the shared helper
 * (`_shared/virtual-list.tsx`, the same one the Library's Grid/List views use) renders one screen's
 * worth of rows regardless of preset size.
 *
 * `blocks` is the FILTERED view, so the empty state has to say which nothing it means (RC ships
 * three: searched-to-nothing, an empty In-Chat tab, and a genuinely empty preset). Telling someone
 * "no blocks yet" while four sit behind a filter is a lie, and it hides the way out.
 *
 * FLATTENED ROWS, not a nested tree: the old `.section`/`.sectionBody` markup wrapped a WHOLE
 * category's children in one box (a continuous left border, one shared indent). A virtualizer
 * positions every row independently - nothing spans multiple rows - so each header/block/empty-note
 * row now carries its OWN depth-scaled indent (`block-row.tsx` `.rowIndent`, `list-toolbar`-adjacent
 * `.sectionHead`'s `margin-inline-start` below); the one visible difference is the border reading as
 * short segments with small gaps between rows instead of one unbroken line (row.module.css's
 * `.rowIndent` docblock).
 */
import { Button, Disclosure } from "../../../components/button";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { PresetGroup, PresetPrompt } from "../../../../entities/preset";
import { groupSections, type PromptFilterTab, type PromptSection } from "../../../../core/preset";
import { useIdIndex } from "../../../_shared/editor-state";
import {
  bridgeTabAcrossVirtualBoundary,
  FALLBACK_VIEWPORT,
  keepFocusedInRange,
  useOccurrenceKeys,
  OVERSCAN,
  remToPx,
  useFocusedRangeIndex,
  useVirtualRows,
  type Range,
} from "../../../_shared/virtual-list";
import { BlockRow } from "./block-row";
import s from "./preset.module.css";

export interface BlockListProps {
  /** the filtered view - see totalBlocks for whether the preset itself is empty */
  blocks: PresetPrompt[];
  /** categories; blocks carry groupId. Empty = a flat list, no headers rendered. */
  groups?: PresetGroup[];
  collapsedGroups: ReadonlySet<string>;
  onToggleGroup: (id: string) => void;
  /** how many blocks exist BEFORE the tab/search filter */
  totalBlocks: number;
  tab: PromptFilterTab;
  query: string;
  onClearQuery: () => void;
  onShowAll: () => void;
  selectedId: string | null;
  selectedChecks: ReadonlySet<string>;
  expandedIds: ReadonlySet<string>;
  onSelectRow: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<PresetPrompt>) => void;
  /** `toId` is the block the drag landed ON (never a filtered-list index - M4 dropped that
   * indirection so this callback needs no `blocks`/`shown` lookup to stay stable). */
  onReorder: (fromId: string, toId: string) => void;
  onAdd: () => void;
}

function ListEmpty({
  totalBlocks,
  tab,
  query,
  onClearQuery,
  onShowAll,
}: Pick<BlockListProps, "totalBlocks" | "tab" | "query" | "onClearQuery" | "onShowAll">): JSX.Element {
  if (query.trim()) {
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>No prompts match &ldquo;{query.trim()}&rdquo;</p>
        <Button size="sm" onClick={onClearQuery}>Clear search</Button>
      </div>
    );
  }
  if (totalBlocks > 0) {
    const what = tab === "inchat" ? "in-chat injections" : "relative prompts";
    const how =
      tab === "inchat"
        ? "Move a prompt to In-Chat from its Placement, or add one and set its depth."
        : "Every prompt here is injected at a depth. Set one to Relative from its Placement.";
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>No {what}</p>
        <p className={s.emptyHint}>{how}</p>
        <Button size="sm" onClick={onShowAll}>Show all</Button>
      </div>
    );
  }
  return <div className={s.empty}>No prompt blocks yet. Add one to start building the preset.</div>;
}

/** One virtual row: a category header, its "nothing here" note, one block, or the trailing "add"
 * control - all in the SAME flat, absolutely-positioned window. */
type Row =
  | { kind: "header"; key: string; section: PromptSection }
  | { kind: "sectionEmpty"; key: string; depth: number }
  | { kind: "block"; key: string; block: PresetPrompt; depth: number }
  | { kind: "add"; key: "row:add" };

const HEADER_PX = 40;
const EMPTY_NOTE_PX = 34;
const ADD_PX = 44;
/** Close to a collapsed row's real ~52px (row.module.css `.prow` padding + line height); expanded
 * rows correct themselves via `measureElement` once their textarea paints, same pattern as the
 * Library List view (`views/list.tsx` `ROW_ESTIMATE_PX`). */
const COLLAPSED_PX = 52;
const EXPANDED_ESTIMATE_PX = 220;
const ROW_GAP_REM = 0.4; // preset.module.css .list's old flex `gap`

const blockId = (b: PresetPrompt): string => b.id;

function buildRows(
  blocks: readonly PresetPrompt[],
  groups: readonly PresetGroup[],
  collapsedGroups: ReadonlySet<string>,
): Row[] {
  const out: Row[] = [];
  if (groups.length > 0) {
    const sections = groupSections(blocks, groups);
    for (const sec of sections) {
      if (sec.group === null) {
        for (const b of sec.prompts) out.push({ kind: "block", key: b.id, block: b, depth: 0 });
        continue;
      }
      if (!sec.ancestorIds.every((id) => !collapsedGroups.has(id))) continue; // an ancestor is collapsed
      out.push({ kind: "header", key: `section:${sec.group.id}`, section: sec });
      if (collapsedGroups.has(sec.group.id)) continue;
      if (sec.prompts.length === 0) {
        if (!sec.hasChildren) out.push({ kind: "sectionEmpty", key: `empty:${sec.group.id}`, depth: sec.depth });
      } else {
        for (const b of sec.prompts) out.push({ kind: "block", key: b.id, block: b, depth: sec.depth });
      }
    }
  } else {
    for (const b of blocks) out.push({ kind: "block", key: b.id, block: b, depth: 0 });
  }
  out.push({ kind: "add", key: "row:add" });
  return out;
}

export function BlockList({
  blocks,
  groups = [],
  collapsedGroups,
  onToggleGroup,
  totalBlocks,
  tab,
  query,
  onClearQuery,
  onShowAll,
  selectedId,
  selectedChecks,
  expandedIds,
  onSelectRow,
  onToggleCheck,
  onToggleExpand,
  onToggle,
  onDelete,
  onPatch,
  onReorder,
  onAdd,
}: BlockListProps): JSX.Element {
  // A ref, not state: dragging never has to re-render BlockList (M4 "stable handlers") - only the
  // drop lands a real edit.
  const dragIdRef = useRef<string | null>(null);
  const [dragFocusKey, setDragFocusKey] = useState<string | null>(null);
  const onRowDragStart = useCallback((id: string, focusKey: string): void => { dragIdRef.current = id; setDragFocusKey(focusKey); }, []);
  const clearDrag = useCallback((): void => {
    dragIdRef.current = null;
    setDragFocusKey(null);
  }, []);
  const onRowDropOn = useCallback((id: string): void => {
    const from = dragIdRef.current;
    clearDrag();
    if (from && from !== id) onReorder(from, id);
  }, [clearDrag, onReorder]);

  /** id -> position in the FILTERED list (M4: replaces `blocks.findIndex` inside every row). */
  const idIndex = useIdIndex(blocks, blockId);

  const rows = useMemo(() => buildRows(blocks, groups, collapsedGroups), [blocks, groups, collapsedGroups]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(rows, "preset-block-list", (row) => `${row.kind}:${row.key}`, (row) => row.kind === "block" ? row.block : row.kind === "header" ? row.section.group ?? undefined : row);
  const dragIndex = dragFocusKey === null ? -1 : rowIndex(dragFocusKey);
  const focusableRows = useMemo(() => rows.flatMap((row, index) => row.kind === "sectionEmpty" ? [] : [{ row, index }]), [rows]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemKey = useCallback((index: number) => rowKeys[index]!, [rowKeys]);
  const flatIndexOfFocused = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const toRangeIndex = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, toRangeIndex,
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);

  const virtualizer = useVirtualRows({
    mode: "variable",
    count: rows.length,
    getScrollElement,
    getItemKey,
    estimateSize: (i) => {
      const row = rows[i]!;
      if (row.kind === "header") return HEADER_PX;
      if (row.kind === "sectionEmpty") return EMPTY_NOTE_PX;
      if (row.kind === "add") return ADD_PX;
      return expandedIds.has(row.block.id) ? EXPANDED_ESTIMATE_PX : COLLAPSED_PX;
    },
    overscan: OVERSCAN,
    gap: remToPx(ROW_GAP_REM),
    rangeExtractor: useCallback((range: Range) => {
      const indexes = keepFocusedInRange(range, focusedIndex);
      return dragIndex < 0 || indexes.includes(dragIndex) ? indexes : [...indexes, dragIndex].sort((a, b) => a - b);
    }, [focusedIndex, dragIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  useEffect(() => {
    const index = rows.findIndex((row) => row.kind === "block" && row.block.id === selectedId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [rows, selectedId, virtualizer]);

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const key = document.activeElement?.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    const current = focusableRows.findIndex(({ index }) => rowKeys[index] === key);
    if (current < 0) return;
    bridgeTabAcrossVirtualBoundary(ev, {
      scrollToIndex: (i, options) => virtualizer.scrollToIndex(focusableRows[i]!.index, options),
    }, focusableRows.length, current, ev.currentTarget, (i) => rowKeys[focusableRows[i]!.index]!);
  };

  // Which "nothing" is this? A filter hiding everything gets the escape hatch; a preset with no
  // blocks but real categories must still render the folders, or making one looks like a no-op.
  const filteredToNothing = blocks.length === 0 && (query.trim() !== "" || (tab !== "all" && totalBlocks > 0));
  const trulyEmpty = totalBlocks === 0 && groups.length === 0;

  if (filteredToNothing || trulyEmpty) {
    return (
      <div className={s.list}>
        <ListEmpty totalBlocks={totalBlocks} tab={tab} query={query} onClearQuery={onClearQuery} onShowAll={onShowAll} />
        <Button size="sm" onClick={onAdd}>+ Add block</Button>
      </div>
    );
  }

  return (
    <div className={s.list} ref={scrollRef} onKeyDown={onKeyDown} onFocus={onFocus}>
      <div className={s.listInner} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const row = rows[vRow.index];
          if (!row) return null;
          const style: CSSProperties = { transform: `translateY(${String(vRow.start)}px)` };
          if (row.kind === "add") {
            return (
              <div key={rowKeys[vRow.index]} ref={virtualizer.measureElement} data-index={vRow.index} data-pick={rowKeys[vRow.index]} className={s.listRow} style={style}>
                <Button size="sm" onClick={onAdd}>+ Add block</Button>
              </div>
            );
          }
          if (row.kind === "header") {
            const sec = row.section;
            const open = !collapsedGroups.has(sec.group!.id);
            return (
              <div key={rowKeys[vRow.index]} ref={virtualizer.measureElement} data-index={vRow.index} data-pick={rowKeys[vRow.index]} className={s.listRow} style={style}>
                <div className={s.section} data-depth={sec.depth} style={{ "--preset-group-depth": sec.depth } as CSSProperties}>
                  <Disclosure
                    open={open}
                    onClick={() => onToggleGroup(sec.group!.id)}
                    label={sec.group!.name || "Untitled category"}
                    summary={sec.totalPromptCount}
                  />
                </div>
              </div>
            );
          }
          if (row.kind === "sectionEmpty") {
            return (
              <div key={row.key} ref={virtualizer.measureElement} data-index={vRow.index} className={s.listRow} style={style}>
                <p
                  className={s.sectionEmpty}
                  style={{ "--preset-group-depth": row.depth } as CSSProperties}
                  data-depth={row.depth}
                >
                  Nothing in this category.
                </p>
              </div>
            );
          }
          const b = row.block;
          const index = idIndex.get(b.id) ?? 0;
          return (
            <div key={rowKeys[vRow.index]} ref={virtualizer.measureElement} data-index={vRow.index} className={s.listRow} style={style}>
              <BlockRow
                block={b}
                focusKey={rowKeys[vRow.index]!}
                index={index}
                depth={row.depth}
                posinset={index + 1}
                setsize={blocks.length}
                active={selectedId === b.id}
                selected={selectedChecks.has(b.id)}
                expanded={expandedIds.has(b.id)}
                onSelectRow={onSelectRow}
                onToggleCheck={onToggleCheck}
                onToggleExpand={onToggleExpand}
                onToggle={onToggle}
                onDelete={onDelete}
                onPatch={onPatch}
                onDragStart={onRowDragStart}
                onDragEnd={clearDrag}
                onDropOn={onRowDropOn}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
