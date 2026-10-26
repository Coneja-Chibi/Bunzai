/**
 * The Library's collections chrome: a row of the person's own groupings, and the control that puts
 * staged pieces into one.
 *
 * A renderer. Every decision about what a collection is, what an edit does, and which pieces are in
 * one lives in collections-shape.ts and collections-ops.ts, so this file holds nothing worth testing
 * without a browser.
 *
 * BROWSING A COLLECTION IS A SEARCH. Clicking a chip writes `collection:<id>` into the box that was
 * already there, which is why this file has no shelf, no empty state and no view modes of its own -
 * the room it filters is the room that already works. It also means the person can SEE why the shelf
 * changed, and can edit or delete the term by hand like any other.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent } from "react";
import {
  collectionQuery,
  collectionsBarProps,
  type CollectionsBarInput,
} from "./collections-ops";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { Button, Chip } from "../../components/button";

export function CollectionsBar(input: CollectionsBarInput): JSX.Element | null {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  /**
   * THE BAR REPORTS ITS OWN OUTCOMES. The mono status bar cannot carry them - see the note on
   * `say` in collections-ops.ts, where the room's status effect was watched overwriting a handler's
   * message in the same tick. A failed write with nowhere to say so is the case that matters.
   */
  const [notice, setNotice] = useState("");
  const { all, query, onQuery, staged, onCreate, onAddStaged, onDelete } =
    collectionsBarProps({ ...input, say: setNotice });
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(all, "library-collection", (collection) => collection.id);
  const listRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: all.length,
    horizontal: true,
    getScrollElement: () => listRef.current,
    getItemKey: (index) => rowKeys[index]!,
    estimateSize: () => 150,
    gap: remToPx(0.4),
    overscan: OVERSCAN,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  useEffect(() => {
    const current = all.findIndex((collection) => query.trim() === collectionQuery(collection.id));
    if (current >= 0) virtualizer.scrollToIndex(current, { align: "auto" });
  }, [all, query, virtualizer]);
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, all.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  /**
   * NOTHING AT ALL UNTIL THERE IS SOMETHING TO SHOW. A row of chrome for a feature somebody has
   * never used is a permanent tax on the shelf; the New button appears with the first staged piece,
   * which is the moment making a collection first means anything.
   */
  if (all.length === 0 && staged.length === 0) return null;

  const commit = (): void => {
    const name = draft.trim();
    if (name) onCreate(name);
    setDraft("");
    setNaming(false);
  };

  return (
    <div className="colbar">
      <span className="sk">groups</span>
      <div className="colbar-list" ref={listRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <div className="colbar-space" style={{ width: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
        const collection = all[item.index];
        if (!collection) return null;
        const on = query.trim() === collectionQuery(collection.id);
        return (
          <span key={rowKeys[item.index]} ref={virtualizer.measureElement} data-index={item.index} data-pick={rowKeys[item.index]}
            className={`colchip colbar-item${on ? " on" : ""}`} style={{ transform: `translateX(${String(item.start)}px)` }}>
            <Chip pressed={on} title={
                on
                  ? "Showing this collection - click to stop filtering"
                  : `Show only what is in ${collection.name}`
              }
              // A second click clears it. Without that the only way out of a collection is to find
              // and delete the term by hand, which is a trap for anyone who clicked to look.
              onClick={() => onQuery(on ? "" : collectionQuery(collection.id))}>
              {collection.name}
              <span className="colcount">{collection.members.length}</span>
            </Chip>
            {staged.length > 0 && (
              <Button size="sm" variant="quiet" title={`Add ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"} to ${collection.name}`}
                onClick={() => onAddStaged(collection.id)}>
                Add
              </Button>
            )}
            <Button size="sm" variant="danger" title={`Delete the collection ${collection.name}. The pieces stay in the studio.`}
              onClick={() => onDelete(collection)}>
              Remove
            </Button>
          </span>
        );
        })}
        </div>
      </div>

      {naming ? (
        <input
          className="colnew"
          autoFocus
          value={draft}
          maxLength={120}
          placeholder="name this group"
          aria-label="Name the new collection"
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") commit();
            if (isEscapeClose(ev)) {
              // Leaving the field is a commit, so Escape has to clear the draft BEFORE the blur
              // lands or backing out would create the collection anyway.
              ev.stopPropagation();
              setDraft("");
              setNaming(false);
            }
          }}
        />
      ) : (
        <Button size="sm" title={
            staged.length > 0
              ? `Make a collection from the ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"}`
              : "Make a collection"
          }
          onClick={() => setNaming(true)}>
          New group
        </Button>
      )}

      {notice && (
        <span className="colnote" role="status">
          {notice}
          <Button size="sm" variant="quiet" title="Dismiss" aria-label="Dismiss" onClick={() => setNotice("")}>
            OK
          </Button>
        </span>
      )}
    </div>
  );
}
