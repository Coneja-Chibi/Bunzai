/**
 * LiveBuild - the engine-truth pane. Renders core/preset `buildPreview(body)` and NOTHING else: the
 * enabled blocks in real BUILD order (placement rank, then injectionOrder), markers labelled where
 * they splice, per-line tokens. It is not a mock and must never become one - if this pane and the
 * export ever disagree, the pane is the bug.
 *
 * Honest limit, stated in the UI rather than hidden: macros stay LITERAL here. Resolving them needs
 * a rehearsal context (a real chat surface) that vaud does not have yet, so the wire's "macros
 * resolved" is tiered to the walkthrough runtime. Showing a fake resolution would be worse than
 * showing none: it would look like engine truth and quietly lie.
 *
 * The pane is whole-preset, which is why it lives in the rail rather than the row (the locked wire's
 * ruling: the rail holds only what is true of the WHOLE preset).
 */
import { useCallback, useMemo, useRef, type JSX, type KeyboardEvent } from "react";
import type { PresetBody } from "../../../../entities/preset";
import { buildPreview, PRESET_PLACEMENT_LABELS } from "../../../../core/preset";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, remToPx, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import s from "./live-build.module.css";

export interface LiveBuildProps {
  body: PresetBody;
  /** jump the editor to a block when its built line is clicked */
  onSelect: (id: string) => void;
}

export function LiveBuild({ body, onSelect }: LiveBuildProps): JSX.Element {
  const build = useMemo(() => buildPreview(body), [body]);
  const { lines, weight } = build;
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(lines, "live-build", (line) => line.id);
  const listRef = useRef<HTMLOListElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: lines.length,
    getScrollElement: () => listRef.current,
    getItemKey: (index) => rowKeys[index]!,
    estimateSize: () => 120,
    gap: remToPx(0.4),
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const onListKeyDown = (event: KeyboardEvent<HTMLOListElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, lines.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <span className={s.headline}>
          {lines.length} block{lines.length === 1 ? "" : "s"} in build order
        </span>
        <span className={s.weight}>~{weight.tokens} tok</span>
      </div>

      {lines.length === 0 ? (
        <p className={s.empty}>
          {body.prompts.length === 0
            ? "Nothing to build yet. Add a block."
            : "Every block is switched off, so this preset builds to nothing."}
        </p>
      ) : (
        <ol className={s.list} ref={listRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
          <li aria-hidden className={s.space} style={{ height: virtualizer.getTotalSize() }} />
          {virtualizer.getVirtualItems().map((item) => {
            const l = lines[item.index];
            if (!l) return null;
            return (
            <li key={rowKeys[item.index]} ref={virtualizer.measureElement} data-index={item.index} data-pick={rowKeys[item.index]} className={s.line} style={{ transform: `translateY(${String(item.start)}px)` }}>
              <button type="button" className={s.lineHead} onClick={() => onSelect(l.id)}>
                <span className={s.ord}>{String(item.index + 1).padStart(2, "0")}</span>
                <span className={s.lineName}>{l.name || "Untitled block"}</span>
                <span className={s.role}>{l.role}</span>
                <span className={s.stop}>
                  {PRESET_PLACEMENT_LABELS[l.placement]?.label ?? l.placement}
                  {l.depth !== undefined ? ` @${l.depth}` : ""}
                </span>
                <span className={s.tok}>{l.isMarker ? "slot" : `${l.tokens}`}</span>
              </button>
              <pre className={`${s.text} ${l.isMarker ? s.markerText : ""}`}>{l.text || "(empty)"}</pre>
            </li>
            );
          })}
        </ol>
      )}

      <p className={s.note}>
        Real assembly order, straight from the build engine. Macros stay literal until a rehearsal
        context exists to resolve them against.
      </p>
    </div>
  );
}
