/**
 * RuleToc - the quiet table of contents (design/vs-regex-editor.html .toc). Each row shows the rule
 * name, an on/off pip, and the COMPUTED doesLine (never stored); the foot adds a new rule. The Select
 * toggle and the slow chip are placeholders for later slices (bulk ops / persisted telemetry) - shown
 * disabled/absent rather than faked, so the TOC never lies about state it does not have.
 */
import { useCallback, useEffect, useRef, type JSX, type KeyboardEvent } from "react";
import type { RegexRule } from "../../../../entities/regex/schema";
import { doesLine } from "./does-line";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";

export interface RuleTocProps {
  rules: readonly RegexRule[];
  focusedId: string | null;
  styles: Readonly<Record<string, string>>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** Rule ids wearing the quiet "slow" chip (R4 health); absent = no chips. */
  slowIds?: ReadonlySet<string>;
}

export function RuleToc({ rules, focusedId, styles, onSelect, onAdd, slowIds }: RuleTocProps): JSX.Element {
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(rules, "regex-rule", (rule) => rule.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((i: number) => i, []), useCallback((i: number) => rowKeys[i], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: rules.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (i) => rowKeys[i]!,
    estimateSize: () => 52,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  useEffect(() => {
    const index = rules.findIndex((rule) => rule.id === focusedId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [rules, focusedId, virtualizer]);
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, rules.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  return (
    <aside className={styles.toc}>
      <p className={styles.tocTitle}>
        Rules
        <button
          type="button"
          className={styles.selMode}
          disabled
          title="Bulk select comes in a later slice"
        >
          Select
        </button>
      </p>

      <div className={styles.rows} ref={scrollRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const rule = rules[item.index];
            if (!rule) return null;
            const on = focusedId === rule.id;
            return (
              <button
                key={rowKeys[item.index]}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-pick={rowKeys[item.index]}
                type="button"
                className={on ? `${styles.trow} ${styles.trowOn} ${styles.virtualRow}` : `${styles.trow} ${styles.virtualRow}`}
                style={{ transform: `translateY(${String(item.start)}px)` }}
                aria-pressed={on}
                onClick={() => onSelect(rule.id)}
              >
                <span className={styles.trowName}>
                  <span className={rule.enabled ? `${styles.pip} ${styles.pipOn}` : `${styles.pip} ${styles.pipOff}`} aria-hidden="true" />
                  {rule.label.trim() || "Untitled rule"}
                  {slowIds?.has(rule.id) && <span className={styles.trowSlow}>slow</span>}
                </span>
                <span className={styles.trowDoes}>{doesLine(rule)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className={styles.tocAdd} onClick={onAdd}>
        + New rule
      </button>
    </aside>
  );
}
