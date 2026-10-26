/**
 * LoreEntryToc - list rows + focused EntryItem card (RoleCall port).
 * Match overrides also live on the page Keys card; Advanced holds memo/recursion/budget.
 */
import { Button, Chip, Toggle } from "../../../components/button";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX, type KeyboardEvent } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import type { SearchApi } from "../../../app-contract-search";
import { SEARCH_RESULT_CEILING } from "../../../../core/search/contracts";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { matchingLoreEntryIndexesRange } from "../../../../core/search/lore-matching";
import { entryFireMode, fireModePatch } from "./entry-fire-mode";
import { LoreBulkBar } from "./bulk-bar";
import { ModeSelect } from "./entry-toc-mode";
import { EntryTocItem } from "./entry-toc-item";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";

type TocRow = { kind: "group"; key: string; label: string; count: number } | { kind: "entry"; key: string; entry: LorebookEntry };
type TocSearchResult = { query: string; entries: readonly LorebookEntry[]; revision: string; draftChanged: boolean; indexes: Set<number>; truncated: boolean };

export interface EntryTocProps {
  bookId: string;
  searchRevision: string;
  draftChanged: boolean;
  search: SearchApi["search"];
  entries: readonly LorebookEntry[];
  focusedId: string | null;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  categories?: readonly LorebookCategory[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Drag-drop reorder: move id to toIndex in body.entries. */
  onReorder: (id: string, toIndex: number) => void;
  selectMode?: boolean;
  onSelectMode?: (on: boolean) => void;
  picked?: ReadonlySet<string>;
  onTogglePick?: (id: string) => void;
  onBulkEnable?: (on: boolean) => void;
  onBulkDelete?: () => void;
  onClearPick?: () => void;
  onBulkMove?: () => void;
  onOpenBeside?: (id: string) => void;
  healthByEntry?: ReadonlyMap<string, "problem" | "worth-a-look">;
}

function healthPipClass(
  health: "problem" | "worth-a-look" | undefined,
  enabled: boolean,
  styles: Readonly<Record<string, string>>,
): string {
  if (!enabled) return `${styles.tpip} ${styles.pipOff}`;
  if (health === "problem") return `${styles.tpip} ${styles.pipProblem}`;
  if (health === "worth-a-look") return `${styles.tpip} ${styles.pipWarn}`;
  return `${styles.tpip} ${styles.pipOk}`;
}

function healthTitle(health: "problem" | "worth-a-look" | undefined, enabled: boolean): string {
  if (!enabled) return "Disabled";
  if (health === "problem") return "Health problem";
  if (health === "worth-a-look") return "Worth a look";
  return "Healthy";
}

export function LoreEntryToc({
  bookId,
  searchRevision,
  draftChanged,
  search,
  entries,
  focusedId,
  writeFor,
  styles,
  categories = [],
  onSelect,
  onAdd,
  onPatch,
  onDuplicate,
  onDelete,
  onReorder,
  selectMode = false,
  onSelectMode,
  picked,
  onTogglePick,
  onBulkEnable,
  onBulkDelete,
  onClearPick,
  onBulkMove,
  onOpenBeside,
  healthByEntry,
}: EntryTocProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFocusKey, setDragFocusKey] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<TocSearchResult | null>(null);
  const q = query.trim().toLowerCase();
  const matchingIndexes = searchResult?.query === query && searchResult.entries === entries && searchResult.revision === searchRevision && searchResult.draftChanged === draftChanged
    ? searchResult.indexes : null;
  useEffect(() => {
    if (!q) { setSearchResult(null); return; }
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const draftSearch = (): void => {
        const found = new Set<number>();
        let truncated = false;
        let at = 0;
        const next = (): void => {
          if (!alive) return;
          const end = Math.min(entries.length, at + 256);
          for (const index of matchingLoreEntryIndexesRange(query, entries, at, end)) {
            if (found.size < SEARCH_RESULT_CEILING) found.add(index);
            else truncated = true;
          }
          at = end;
          if (at < entries.length) setTimeout(next, 0);
          else setSearchResult({ query, entries, revision: searchRevision, draftChanged, indexes: found, truncated });
        };
        next();
      };
      if (draftChanged) { draftSearch(); return; }
      void (async () => {
        const found = new Set<number>();
        let truncated = false;
        let generation: number | undefined;
        let total = 0;
        let available = 0;
        for (let offset = 0; offset === 0 || offset < Math.min(available, SEARCH_RESULT_CEILING); offset += 500) {
          const page = await search({ query, scope: { kind: "lorebook-entry", id: bookId, revision: searchRevision }, offset, limit: 500, ...(generation === undefined ? {} : { generation }) }, controller.signal);
          if (!alive) return;
          if (page.stale || page.generation === undefined || (generation !== undefined && generation !== page.generation)
            || (generation !== undefined && (page.total !== total || page.available !== available))) { draftSearch(); return; }
          generation = page.generation;
          total = page.total;
          available = page.available;
          truncated = page.truncated === true;
          for (const hit of page.hits) if (typeof hit.entryIndex === "number" && hit.entryIndex >= 0 && hit.entryIndex < entries.length) found.add(hit.entryIndex);
        }
        if (alive) setSearchResult({ query, entries, revision: searchRevision, draftChanged, indexes: found, truncated });
      })().catch(() => { if (alive) draftSearch(); });
    }, 150);
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [q, query, entries, bookId, searchRevision, draftChanged, search]);
  const alwaysOn = useMemo(() => entries.filter((e, index) => e.constant && (matchingIndexes === null || matchingIndexes.has(index))), [entries, matchingIndexes]);
  const keyed = useMemo(() => entries.filter((e, index) => !e.constant && (matchingIndexes === null || matchingIndexes.has(index))), [entries, matchingIndexes]);
  const rows = useMemo(() => [
    ...(alwaysOn.length ? [{ kind: "group" as const, key: "group:always", label: "Always on", count: alwaysOn.length }] : []),
    ...alwaysOn.map((entry): TocRow => ({ kind: "entry", key: entry.id, entry })),
    { kind: "group" as const, key: "group:keyed", label: "Entries", count: keyed.length },
    ...keyed.map((entry): TocRow => ({ kind: "entry", key: entry.id, entry })),
  ], [alwaysOn, keyed]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(rows, "lore-toc", (item) => `${item.kind}:${item.key}`, (item) => item.kind === "entry" ? item.entry : item);
  const dragIndex = dragFocusKey === null ? -1 : rowIndex(dragFocusKey);
  const focusableRows = useMemo(() => rows.flatMap((item, rowIndex) => item.kind === "entry" ? [{ rowIndex, key: rowKeys[rowIndex]! }] : []), [rows, rowKeys]);
  const focusableIndexByKey = useMemo(() => new Map<string, number>(focusableRows.map((record, index): [string, number] => [record.key, index])), [focusableRows]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const keyAtIndex = useCallback((index: number) => rowKeys[index], [rowKeys]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((i: number) => i, []), keyAtIndex, rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (i) => rowKeys[i]!,
    estimateSize: (i) => rows[i]!.kind === "group" ? 32 : focusedId === rows[i]!.key ? 220 : 42,
    rangeExtractor: useCallback((range: Range) => {
      const indexes = keepFocusedInRange(range, focusedIndex);
      return dragIndex < 0 || indexes.includes(dragIndex) ? indexes : [...indexes, dragIndex].sort((a, b) => a - b);
    }, [focusedIndex, dragIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;
  const selectedIndex = rows.findIndex((item) => item.kind === "entry" && item.entry.id === focusedId);
  useEffect(() => { if (selectedIndex >= 0) scrollToIndexRef.current(selectedIndex, { align: "auto" }); }, [selectedIndex, rowKeys]);
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab") return;
    const id = document.activeElement?.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    const occurrenceIndex = id ? focusableIndexByKey.get(id) ?? -1 : -1;
    if (occurrenceIndex < 0) return;
    bridgeTabAcrossVirtualBoundary(event, {
      scrollToIndex: (i, options) => virtualizer.scrollToIndex(focusableRows[i]!.rowIndex, options),
    }, focusableRows.length, occurrenceIndex, event.currentTarget, (i) => focusableRows[i]!.key);
  };
  const pickCount = picked?.size ?? 0;
  const vectorOk = fieldVisible(writeFor, "vectorized");
  const canDrag = !selectMode && q === "";

  const dropOn = (targetId: string): void => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragFocusKey(null);
      setOverId(null);
      return;
    }
    const toIndex = entries.findIndex((e) => e.id === targetId);
    if (toIndex >= 0) onReorder(dragId, toIndex);
    setDragId(null);
    setDragFocusKey(null);
    setOverId(null);
  };

  const row = (e: LorebookEntry, focusKey: string): JSX.Element => {
    const focused = e.id === focusedId;
    const tokens = estimateEntryTokens(e);
    const isPicked = picked?.has(e.id) ?? false;
    const health = healthByEntry?.get(e.id);
    const mode = entryFireMode(e);
    const canMode = fieldVisible(writeFor, "constant");

    const dragHandlers = {
      draggable: canDrag,
      onDragStart: (ev: DragEvent) => {
        if (!canDrag) {
          ev.preventDefault();
          return;
        }
        setDragId(e.id);
        setDragFocusKey(focusKey);
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", e.id);
      },
      onDragEnd: () => {
        setDragId(null);
        setDragFocusKey(null);
        setOverId(null);
      },
      onDragOver: (ev: DragEvent) => {
        if (!dragId || dragId === e.id) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        setOverId(e.id);
      },
      onDragLeave: () => {
        if (overId === e.id) setOverId(null);
      },
      onDrop: (ev: DragEvent) => {
        ev.preventDefault();
        dropOn(e.id);
      },
    };

    if (focused && !selectMode) {
      return (
        <div key={e.id} {...dragHandlers}>
          <EntryTocItem
            entry={e}
            writeFor={writeFor}
            styles={styles}
            categories={categories}
            onPatch={(patch) => onPatch(e.id, patch)}
            onOpen={() => onSelect(e.id)}
            onDuplicate={() => onDuplicate(e.id)}
            onDelete={() => onDelete(e.id)}
            onOpenBeside={onOpenBeside ? () => onOpenBeside(e.id) : undefined}
          />
        </div>
      );
    }

    const cls = [
      styles.trow,
      focused ? styles.trowOn : "",
      !e.enabled ? styles.trowOff : "",
      overId === e.id && dragId && dragId !== e.id ? styles.trowDrop : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div key={e.id} {...dragHandlers}>
        <div
          role="button"
          tabIndex={0}
          className={cls}
          onClick={() => {
            if (selectMode && onTogglePick) onTogglePick(e.id);
            else onSelect(e.id);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              if (selectMode && onTogglePick) onTogglePick(e.id);
              else onSelect(e.id);
            }
          }}
        >
          {!selectMode && (
            <Toggle size="sm" on={e.enabled} aria-label={e.enabled ? "Entry on" : "Entry off"} title={e.enabled ? "On - click to disable" : "Off - click to enable"} isolate onChange={() => onPatch(e.id, { enabled: !e.enabled })} />
          )}
          {selectMode ? (
            <span
              className={isPicked ? `${styles.cb} ${styles.cbOn}` : styles.cb}
              aria-hidden="true"
            />
          ) : (
            <span
              className={healthPipClass(health, e.enabled, styles)}
              title={healthTitle(health, e.enabled)}
              aria-label={healthTitle(health, e.enabled)}
            />
          )}
          <div className={styles.tMain}>
            <div className={styles.tTitleRow}>
              <span className={styles.tnm}>{e.title || "(untitled)"}</span>
              {!selectMode && <span className={styles.tokc}>~{tokens}</span>}
            </div>
            {!selectMode && canMode && (
              <ModeSelect
                mode={mode}
                vectorOk={vectorOk}
                styles={styles}
                onChange={(m) => onPatch(e.id, fireModePatch(m))}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className={styles.toc} aria-label="Table of contents">
      <p className={styles.tocTitle}>
        Table of contents
        {onSelectMode && (
          <Chip pressed={selectMode} onClick={() => onSelectMode(!selectMode)}>Select</Chip>
        )}
      </p>
      <label className={styles.tocSearch}>
        <span>&#8981;</span>
        <input
          value={query}
          placeholder={`Search ${entries.length} ${entries.length === 1 ? "entry" : "entries"}…`}
          aria-label="Search entries"
          onChange={(ev) => setQuery(ev.target.value)}
        />
      </label>
      {matchingIndexes && searchResult?.truncated && <p className={styles.dragHint}>First {String(matchingIndexes.size)} matching entries are shown; the search result limit was reached.</p>}
      {canDrag && (
        <p className={styles.dragHint}>Drag rows to reorder</p>
      )}

      <div className={styles.tocItems} ref={scrollRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const current = rows[item.index];
            if (!current) return null;
            return (
              <div key={rowKeys[item.index]} ref={virtualizer.measureElement} data-index={item.index}
                data-pick={current.kind === "entry" ? rowKeys[item.index] : undefined}
                className={styles.virtualRow} style={{ transform: `translateY(${String(item.start)}px)` }}>
                {current.kind === "group"
                  ? <div className={styles.tocGroup}>{current.label}<i className={styles.gcount}>{current.count}</i></div>
                  : row(current.entry, rowKeys[item.index]!)}
              </div>
            );
          })}
        </div>
      </div>
      {entries.length === 0 && <p className={styles.tocEmpty}>The book is empty.</p>}
      {entries.length > 0 && alwaysOn.length + keyed.length === 0 && (
        <p className={styles.tocEmpty}>Nothing matches &quot;{query.trim()}&quot;.</p>
      )}

      <Button size="sm" block onClick={onAdd}>+ New entry</Button>

      {selectMode && pickCount > 0 && onBulkEnable && onBulkDelete && onClearPick && (
        <LoreBulkBar
          count={pickCount}
          styles={styles}
          onEnable={onBulkEnable}
          onDelete={onBulkDelete}
          onClear={onClearPick}
          onMove={onBulkMove}
        />
      )}
    </aside>
  );
}
