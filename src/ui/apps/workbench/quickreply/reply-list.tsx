/** Windowed quick-reply rows, keeping each controlled button's fields mounted only near the view. */
import { useCallback, useRef, type JSX, type KeyboardEvent } from "react";
import type { QuickReply } from "../../../../entities/quickreply/schema";
import { ExpandTextarea } from "../../../components/expand";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, remToPx, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { framed as f, useFramed } from "../framed";
import { EditorField } from "../layout/editor-field";
import s from "./quickreply.module.css";

export function QuickReplyList({ replies, onAdd, onPatch, onRemove }: {
  replies: readonly QuickReply[];
  onAdd(): void;
  onPatch(id: string, patch: Partial<QuickReply>): void;
  onRemove(id: string): void;
}): JSX.Element {
  const themed = useFramed();
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(replies, "quick-reply", (reply) => reply.id);
  const listRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []), useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: replies.length,
    getScrollElement: () => listRef.current,
    getItemKey: (index) => rowKeys[index]!,
    estimateSize: () => 240,
    gap: remToPx(0.75),
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, replies.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  return (
    <>
      {replies.length === 0 && <p className={s.empty}>This set has no buttons yet.</p>}
      <div className={s.items} ref={listRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <div className={s.itemsSpace} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const reply = replies[item.index];
            if (!reply) return null;
            return (
              <section className={`${s.row} ${themed ? s.rowFramed : ""} ${s.virtualRow}`} key={rowKeys[item.index]} ref={virtualizer.measureElement} data-index={item.index} data-pick={rowKeys[item.index]}
                style={{ transform: `translateY(${String(item.start)}px)` }}>
                {themed ? (
                  <div className={f.fields}>
                    <EditorField label="Label" htmlFor={`${rowKeys[item.index]}-label`}><input id={`${rowKeys[item.index]}-label`} className={s.field} value={reply.label} onChange={(event) => onPatch(reply.id, { label: event.target.value })} /></EditorField>
                    <EditorField label="Hover title" htmlFor={`${rowKeys[item.index]}-title`}><input id={`${rowKeys[item.index]}-title`} className={s.field} value={reply.title ?? ""} onChange={(event) => onPatch(reply.id, { title: event.target.value || undefined })} /></EditorField>
                    <EditorField label="Message or slash-command text" wide>
                      <ExpandTextarea label="Quick-reply message" className={`${s.field} ${s.message}`} value={reply.message}
                        onChange={(event) => onPatch(reply.id, { message: event.target.value })} />
                    </EditorField>
                  </div>
                ) : (
                  <>
                    <div className={s.stack}>
                      <label><span className={s.label}>Label</span><input className={s.field} value={reply.label} onChange={(event) => onPatch(reply.id, { label: event.target.value })} /></label>
                      <label><span className={s.label}>Hover title</span><input className={s.field} value={reply.title ?? ""} onChange={(event) => onPatch(reply.id, { title: event.target.value || undefined })} /></label>
                    </div>
                    <label><span className={s.label}>Message or slash-command text</span>
                      <ExpandTextarea label="Quick-reply message" className={`${s.field} ${s.message}`} value={reply.message}
                        onChange={(event) => onPatch(reply.id, { message: event.target.value })} />
                    </label>
                  </>
                )}
                <div className={s.actions}>
                  <label><input type="checkbox" checked={reply.hidden === true} onChange={(event) => onPatch(reply.id, { hidden: event.target.checked })} /> Hidden</label>
                  <button className={s.button} type="button" onClick={() => onRemove(reply.id)}>Remove</button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <button className={`${s.button} ${s.add}`} type="button" onClick={onAdd}>Add button</button>
    </>
  );
}
