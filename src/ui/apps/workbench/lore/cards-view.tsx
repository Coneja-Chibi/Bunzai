/**
 * Cards lens: browsable wall of entries (vs-lore-lenses).
 * Wireframe-faithful: title + mode, 3-line peek, key chips, tok/on foot.
 * Mode chip cycles Keyword / Always on / By meaning. Click tile opens Pages.
 */
import { Chip, Tile } from "../../../components/button";
import { useCallback, useMemo, useRef, type JSX, type KeyboardEvent } from "react";
import type { LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch, type EntryFireMode } from "./entry-fire-mode";
import styles from "./cards-view.module.css";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, rowsOf, useFocusedRangeIndex, useGridColumns, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";

export interface CardsViewProps {
  entries: readonly LorebookEntry[];
  writeFor: LoreWriteForProfile;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void;
  onAdd: () => void;
}

const MODE_LABEL: Record<EntryFireMode, string> = {
  keyed: "Keyword",
  always: "Always on",
  meaning: "By meaning",
};

const MODE_TONE: Record<EntryFireMode, string> = {
  keyed: "var(--stage-ok)",
  always: "var(--stage-var)",
  meaning: "var(--accent)",
};

const cycleMode = (mode: EntryFireMode, vectorOk: boolean): EntryFireMode => {
  if (mode === "keyed") return "always";
  if (mode === "always") return vectorOk ? "meaning" : "keyed";
  return "keyed";
};

type CardCell = { entry: LorebookEntry } | { add: true };

export function CardsView({
  entries,
  writeFor,
  onSelect,
  onPatch,
  onAdd,
}: CardsViewProps): JSX.Element {
  const vectorOk = fieldVisible(writeFor, "vectorized");
  const cards = useMemo(() => [...entries.map((entry): CardCell => ({ entry })), { add: true }], [entries]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(cards, "lore-card", (cell) => "entry" in cell ? `entry:${cell.entry.id}` : "add", (cell) => "entry" in cell ? cell.entry : cell);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cols, gapPx, rowRef } = useGridColumns();
  const rows = rowsOf(cards, cols);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus, onBlur } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => Math.floor(index / Math.max(1, cols)), [cols]),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex, { restoreReparentedFocus: true });
  const virtualizer = useVirtualRows({
    mode: "grid", count: rows.length, getScrollElement: () => scrollRef.current,
    estimateSize: () => 190, gap: gapPx,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const first = virtualRows[0]?.index;
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event,
      { scrollToIndex: (i, options) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), options) },
      cards.length, index, event.currentTarget, (i) => {
        const cell = cards[i]!;
        return rowKeys[i]!;
      });
  };

  return (
    <div className={styles.grid} aria-label="Entry cards" ref={scrollRef} onFocus={onFocus} onBlur={onBlur} onKeyDown={onListKeyDown}>
      <div className={styles.gridSpace} style={{ height: virtualizer.getTotalSize() }}>
      {virtualRows.map((virtualRow) => (
        <div key={virtualRow.index} className={styles.gridRow} ref={(el) => { virtualizer.measureElement(el); if (virtualRow.index === first) rowRef(el); }}
          data-index={virtualRow.index} style={{ transform: `translateY(${String(virtualRow.start)}px)` }}>
      {(rows[virtualRow.index] ?? []).map((cell) => {
        const flat = virtualRow.index * Math.max(1, cols) + rows[virtualRow.index]!.indexOf(cell);
        if ("add" in cell) return <Tile key={rowKeys[flat]} kind="add" label="New entry" data-pick={rowKeys[flat]} onClick={onAdd} />;
        const e = cell.entry;
        const mode = entryFireMode(e);
        const keys = e.triggers.map((t) => t.keyword).filter(Boolean);
        const shown = keys.slice(0, 3);
        const extra = keys.length - shown.length;
        const preview = (e.content || "").trim().replace(/\s+/g, " ");
        const tokens = estimateEntryTokens(e);
        return (
          <div
            key={rowKeys[flat]}
            data-pick={rowKeys[flat]}
            role="button"
            tabIndex={0}
            className={e.enabled ? styles.ecard : `${styles.ecard} ${styles.ecardOff}`}
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(e.id);
              }
            }}
          >
            <div className={styles.echead}>
              <b className={styles.etitle}>{e.title || "(untitled)"}</b>
              <Chip
                color={MODE_TONE[mode]}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onPatch(e.id, fireModePatch(cycleMode(mode, vectorOk)));
                }}
              >
                {MODE_LABEL[mode]}
              </Chip>
            </div>
            <p className={styles.esnip}>
              {preview || "No passage yet."}
            </p>
            <div className={styles.ekeys}>
              {mode === "meaning" && keys.length === 0 ? (
                <span className={`${styles.ekey} ${styles.ekeyMore}`}>
                  no keys · fires by similarity
                </span>
              ) : (
                <>
                  {shown.map((k) => (
                    <span key={`k-${k}`} className={styles.ekey}>
                      {k}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className={`${styles.ekey} ${styles.ekeyMore}`}>+{extra}</span>
                  )}
                </>
              )}
            </div>
            <div className={styles.ecfoot}>
              <span className={styles.tok}>~{tokens} tok</span>
              <span
                className={
                  e.enabled
                    ? styles.onoff
                    : `${styles.onoff} ${styles.onoffOff}`
                }
              >
                {e.enabled ? "On" : "Off"}
              </span>
            </div>
          </div>
        );
      })}
        </div>
      ))}
      </div>
    </div>
  );
}
