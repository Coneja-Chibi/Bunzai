/**
 * The Lorebooks panel's entries view (panels.html 3a to 3c, 3f): the stats line with the book manager button, the search, ONE list of the entries of every active book under a header per
 * book, and the New entry footer. Each book reads Constant first then Selective, each by its sort order, the order the Full Chat list uses. A row carries the entry's on switch, its type and
 * token cost, and under the title WHY it fired last turn (`fireLabel`, which also says "cut by budget" where a dot could not). Move up and Move down stay inside the entry's own group
 * (`position`), as in the wing's row menu. Every book is its own session in `useLoreWing` (own load, revision and save queue), so editing two books saves each against its own base. The
 * headers and rows are one windowed list: a book can hold thousands of entries, so only the rows near the viewport mount.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type JSX, type RefObject } from "react";
import type { LorebookEntry } from "../../../../../../entities/lorebook/schema";
import type { SceneLoreBook, SceneLoreFired } from "../../../../../app-contract-scenes";
import { Button, IconButton, ListRow, Toggle } from "../../../../../components/button";
import { Ic } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import { FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, useFocusedRangeIndex, useVirtualRows, type Range } from "../../../../../_shared/virtual-list";
import { entryMatches, entryTokens, fireLabel, footerLine } from "../../../lore-core";
import { ContextMenu, useContextMenuTrigger, type MenuEntry } from "../../frames/context-menu";
import type { LoreApi } from "./lore-panel";

type LoreActions = ReturnType<LoreApi["actionsFor"]>;

const bySortOrder = (a: LorebookEntry, b: LorebookEntry): number => a.sortOrder - b.sortOrder;

/** The order the list reads in: Constant first, then Selective, each by sort order. The inspector's "entry N of M" counts in this order. */
export function orderedEntries(entries: readonly LorebookEntry[]): { constant: LorebookEntry[]; selective: LorebookEntry[]; all: LorebookEntry[] } {
  const constant = entries.filter((e) => e.constant).sort(bySortOrder);
  const selective = entries.filter((e) => !e.constant).sort(bySortOrder);
  return { constant, selective, all: [...constant, ...selective] };
}

/** The row's second line: the entry's trigger keywords, or "Always on" for a Constant entry, which has none to wait for. */
export function triggerLine(entry: LorebookEntry): string {
  if (entry.constant) return "Always on";
  const keys = entry.triggers.map((t) => t.keyword.trim()).filter(Boolean);
  return keys.length > 0 ? keys.join(", ") : "No triggers";
}

function EntryRow({ entry, pick, fire, atTop, atBottom, actions }: { entry: LorebookEntry; pick: string; fire: string | null; atTop: boolean; atBottom: boolean; actions: LoreActions }): JSX.Element {
  const menu = useContextMenuTrigger();
  const title = entry.title || "Untitled";
  const all: MenuEntry[] = [
    { id: "open", label: "Open and edit", icon: "lucide:pencil", onSelect: () => actions.onSelect(entry.id) },
    { id: "full", label: "Open full editor", icon: "lucide:external-link", hint: "Workbench", onSelect: () => actions.onOpenFull(entry.id) },
    { id: "sep1", separator: true },
    { id: "down", label: "Move down", icon: "lucide:arrow-down", onSelect: () => actions.onMove(entry.id, "down") },
    { id: "up", label: "Move up", icon: "lucide:arrow-up", onSelect: () => actions.onMove(entry.id, "up") },
    { id: "sep2", separator: true },
    { id: "delete", label: "Delete entry", icon: "lucide:trash-2", danger: true, onSelect: () => actions.onDeleteRequest(entry.id) },
  ];
  const items = all.filter((i) => !(i.id === "down" && atBottom) && !(i.id === "up" && atTop));
  return (
    <div className="msn-lore-rw" data-pick={pick} data-part="scene.messenger.lore.entry" data-off={entry.enabled ? undefined : ""} {...menu.bind}>
      <Toggle size="sm" on={entry.enabled} aria-label={`${entry.enabled ? "Disable" : "Enable"} ${title}`} data-part="scene.messenger.lore.entry-switch" onChange={() => actions.onToggleEnabled(entry.id)} />
      <ListRow data-part="scene.messenger.lore.entry-open" label={title} subtitle={triggerLine(entry)} onClick={() => actions.onSelect(entry.id)}
        meta={<span className="mt">{fire && <span className="msn-lore-fire" data-part="scene.messenger.lore.entry-fired" title="Why it fired last turn">{fire}</span>}<span className="msn-lore-tag">{entry.constant ? "Constant" : "Selective"}</span><span>~{entryTokens(entry)}</span></span>} />
      <span className="hbar">
        <IconButton variant="quiet" size="sm" icon="lucide:arrow-up" label={`Move ${title} up`} disabled={atTop} onClick={() => actions.onMove(entry.id, "up")} />
        <IconButton variant="quiet" size="sm" icon="lucide:arrow-down" label={`Move ${title} down`} disabled={atBottom} onClick={() => actions.onMove(entry.id, "down")} />
        <IconButton variant="quiet" size="sm" icon="lucide:external-link" label={`Open ${title} in the full editor`} onClick={() => actions.onOpenFull(entry.id)} />
        <span {...protect("entry-delete")}><IconButton variant="danger" size="sm" icon="lucide:trash-2" label={`Delete ${title}`} onClick={() => actions.onDeleteRequest(entry.id)} /></span>
      </span>
      {menu.at && <ContextMenu items={items} at={menu.at} label={`Entry actions for ${title}`} onClose={menu.close} />}
    </div>
  );
}

/** One line of the one list: a book's header, one of its entries, or what stands in for its entries (loading, gone, failed, empty). */
type Line =
  | { kind: "head"; key: string; book: SceneLoreBook; count: number; open: boolean; ready: boolean }
  | { kind: "entry"; key: string; bookId: string; entry: LorebookEntry; top: boolean; bottom: boolean }
  | { kind: "note"; key: string; bookId: string; title?: string; text: string; addEntry?: boolean };

const lineKey = (bookId: string, entryId: string): string => `${bookId}:${entryId}`;
const ESTIMATE_PX = { head: 32, entry: 56, note: 72 } as const;
const ROW_GAP_PX = 8;

/** The list's lines for every live book: a header each, and under it the entries of a book that is on (or that was opened), minus the collapsed ones and the ones the search skips. */
function buildLines(w: LoreApi, collapsed: ReadonlySet<string>): { lines: Line[]; loaded: number; matched: number } {
  const lines: Line[] = [];
  let loaded = 0;
  let matched = 0;
  for (const book of w.books) {
    if (book.missing) continue;
    const shown = book.enabled || book.id === w.selectedBookId;
    const state = w.stateOf(book.id);
    const ready = state.state === "ready";
    const entries = state.state === "ready" ? state.entity.body.entries : null;
    const open = shown && !collapsed.has(book.id);
    lines.push({ kind: "head", key: `h:${book.id}`, book, count: entries?.length ?? book.entries, open, ready });
    if (!open) continue;
    if (!entries) {
      const text = state.state === "gone" ? "This book is no longer in your library." : state.state === "failed" ? state.why : "Loading the book...";
      lines.push({ kind: "note", key: `n:${book.id}`, bookId: book.id, text });
      continue;
    }
    loaded += entries.length;
    if (entries.length === 0) {
      lines.push({ kind: "note", key: `n:${book.id}`, bookId: book.id, title: "No entries", text: "This lorebook is empty.", addEntry: true });
      continue;
    }
    const { constant, selective, all } = orderedEntries(entries);
    const place = new Map<string, { top: boolean; bottom: boolean }>();
    for (const g of [constant, selective]) g.forEach((e, i) => place.set(e.id, { top: i === 0, bottom: i === g.length - 1 }));
    for (const entry of all) {
      if (!entryMatches(entry, w.entryQuery)) continue;
      matched += 1;
      lines.push({ kind: "entry", key: lineKey(book.id, entry.id), bookId: book.id, entry, top: place.get(entry.id)?.top ?? true, bottom: place.get(entry.id)?.bottom ?? true });
    }
  }
  return { lines, loaded, matched };
}

function BookHead({ line, w, onFold }: { line: Extract<Line, { kind: "head" }>; w: LoreApi; onFold: (id: string) => void }): JSX.Element {
  const { book } = line;
  return (
    <div className="msn-lore-sc" data-part="scene.messenger.lore.book-head" data-pick={line.key}>
      <IconButton variant="quiet" size="sm" icon={line.open ? "lucide:chevron-down" : "lucide:chevron-right"} label={`${line.open ? "Collapse" : "Expand"} ${book.name}`}
        aria-expanded={line.open} data-part="scene.messenger.lore.book-fold" onClick={() => onFold(book.id)} />
      <Ic name="lucide:book" size={14} />{book.name}<span className="n">{line.count}</span><span className="grow" />
      {line.ready && <IconButton variant="quiet" size="sm" icon="lucide:plus" label={`Add an entry to ${book.name}`} data-part="scene.messenger.lore.book-add" onClick={() => w.addEntryTo(book.id)} />}
      <Toggle size="sm" label={book.enabled ? "Active" : "Off"} on={book.enabled} data-part="scene.messenger.lore.book-head-switch"
        aria-label={`${book.enabled ? "Switch off" : "Switch on"} ${book.name}`} onChange={() => w.toggle(book)} />
    </div>
  );
}

/** The windowed lines. The list sits under the search inside the panel's one scroller, so its offset is the scroll margin. */
function Lines({ lines, fired, w, scroll, onFold }: { lines: Line[]; fired: Map<string, SceneLoreFired>; w: LoreApi; scroll: RefObject<HTMLDivElement | null>; onFold: (id: string) => void }): JSX.Element {
  const inner = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const s = scroll.current, l = inner.current;
    if (!s || !l) return;
    const at = l.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop;
    setMargin((m) => (m === at ? m : at));
  }, [scroll, w.books.length]);
  const indexOfFocus = useCallback((t: HTMLElement) => { const key = t.closest<HTMLElement>("[data-pick]")?.dataset["pick"]; return key ? lines.findIndex((l) => (l.kind === "entry" ? l.key : l.key) === key) : -1; }, [lines]);
  const same = useCallback((i: number) => i, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(indexOfFocus, same);
  const virtual = useVirtualRows({
    mode: "list", count: lines.length, getScrollElement: () => scroll.current, getItemKey: (i) => lines[i]!.key, estimateSize: (i) => ESTIMATE_PX[lines[i]?.kind ?? "entry"], gap: ROW_GAP_PX,
    overscan: OVERSCAN, scrollMargin: margin, initialRect: FALLBACK_VIEWPORT, rangeExtractor: useCallback((r: Range) => keepFocusedInRange(r, focusedIndex), [focusedIndex]),
  });
  // A row measures itself where there is layout; with none (a test DOM) it keeps its estimate rather than collapsing to 0.
  const measure = (el: HTMLDivElement | null): void => { if (el && el.getBoundingClientRect().height > 0) virtual.measureElement(el); };
  return (
    <div className="msn-lore-vl" ref={inner} style={{ height: virtual.getTotalSize() }} onFocus={onFocus}>
      {virtual.getVirtualItems().map((v) => {
        const line = lines[v.index];
        if (!line) return null;
        let body: JSX.Element;
        if (line.kind === "head") body = <BookHead line={line} w={w} onFold={onFold} />;
        else if (line.kind === "note") {
          body = (
            <div className="msn-lore-empty" role="status">{line.title && <b>{line.title}</b>}{line.text}
              {line.addEntry && <Button size="sm" variant="primary" onClick={() => w.addEntryTo(line.bookId)}>Add your first entry</Button>}</div>
          );
        } else {
          const f = fired.get(line.key);
          body = <EntryRow entry={line.entry} pick={line.key} fire={f ? fireLabel(f).text : null} atTop={line.top} atBottom={line.bottom} actions={w.actionsFor(line.bookId)} />;
        }
        return <div key={line.key} className="vr" data-index={v.index} ref={measure} style={{ transform: `translateY(${String(v.start - margin)}px)` }}>{body}</div>;
      })}
    </div>
  );
}

/** The inline delete confirmation (panels.html 3f), shared by the list and the inspector. It asks before `confirmDeleteEntry` removes the entry from its book. */
export function DeleteNote({ w, bookName }: { w: LoreApi; bookName: string }): JSX.Element | null {
  const id = w.deleteEntryId;
  if (!id) return null;
  const title = w.entriesOf(w.deleteBookId)?.find((e) => e.id === id)?.title || "Untitled";
  return (
    <div className="msn-lore-note" role="alertdialog" aria-label="Delete this entry" data-part="scene.messenger.lore.delete-note">
      <Ic name="lucide:trash-2" size={14} />
      <div><b>Delete this entry?</b><br />{title} will be removed from {bookName}. The library keeps versions, so you can recover it there.
        <div className="msn-lore-acts">
          <Button size="sm" autoFocus onClick={() => w.setDeleteEntryId(null)}>Keep entry</Button>
          <span {...protect("entry-delete")}><Button size="sm" variant="danger" onClick={w.confirmDeleteEntry}>Delete this entry</Button></span>
        </div>
      </div>
    </div>
  );
}

export function LoreList({ w }: { w: LoreApi }): JSX.Element {
  const scroll = useRef<HTMLDivElement>(null);
  const { entryQuery, lore } = w;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const onFold = useCallback((id: string) => setCollapsed((prev) => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; }), []);
  const lastTurn = lore.state === "ready" ? lore.lastTurn : null;
  const active = w.books.filter((b) => b.enabled && !b.missing);
  const stats = `${active.length} active · ${active.reduce((n, b) => n + b.entries, 0)} entries`;
  const live = w.books.filter((b) => !b.missing);

  const { lines, loaded, matched } = useMemo(() => buildLines(w, collapsed), [w.books, w.stateOf, w.entryQuery, w.selectedBookId, collapsed]); // eslint-disable-line react-hooks/exhaustive-deps -- `w` is a fresh object each render; these are the fields buildLines reads
  const fired = useMemo(() => new Map((lastTurn?.fired ?? []).map((f) => [lineKey(f.bookId, f.entryId), f])), [lastTurn]);
  // The New entry button writes to the book last opened, else the first book that is on and loaded.
  const target = (live.find((b) => b.id === w.selectedBookId) ?? active.find((b) => w.stateOf(b.id).state === "ready"))?.id ?? null;
  const targetReady = target !== null && w.stateOf(target).state === "ready";
  const deleteBook = w.books.find((b) => b.id === w.deleteBookId);

  let main: JSX.Element;
  if (live.length === 0) {
    main = (
      <div className="msn-lore-empty"><b>No lorebooks</b>With none active, entries have nothing to fire. Add one to begin.
        <Button size="sm" variant="primary" icon="lucide:plus" onClick={() => w.setPicking("pane")}>Add a lorebook</Button></div>
    );
  } else {
    main = (
      <>
        <label className="msn-lore-find">
          <Ic name="lucide:search" size={14} />
          <input type="search" value={entryQuery} placeholder="Search entries, text, or triggers" aria-label="Search lorebook entries" onChange={(e) => w.setEntryQuery(e.target.value)} />
          {entryQuery && <Button variant="quiet" size="sm" onClick={() => w.setEntryQuery("")}>Clear</Button>}
        </label>
        <Lines lines={lines} fired={fired} w={w} scroll={scroll} onFold={onFold} />
        {loaded > 0 && matched === 0 && (
          <div className="msn-lore-empty"><b>No matching entries</b>Nothing matches &quot;{entryQuery.trim()}&quot;.<Button size="sm" onClick={() => w.setEntryQuery("")}>Clear search</Button></div>
        )}
        <DeleteNote w={w} bookName={deleteBook?.name ?? "this book"} />
      </>
    );
  }
  return (
    <>
      <div className="msn-lore-top">
        <div className="t"><b>{stats}</b></div>
        <IconButton variant="quiet" size="sm" icon="lucide:sliders-horizontal" label="Browse and add lorebooks" data-part="scene.messenger.lore.books-open" onClick={() => w.setPicking("pane")} />
      </div>
      <div className="msn-lore-main" ref={scroll} data-part="scene.messenger.lore.entries">{main}</div>
      <footer className="msn-lore-foot">
        <Button size="sm" variant="primary" icon="lucide:plus" disabled={!targetReady} data-part="scene.messenger.lore.new-entry" onClick={() => { if (target) w.addEntryTo(target); }}>New entry</Button>
        <span className="grow" />
        {w.saving > 0 && <span className="sv"><Ic name="lucide:loader-circle" size={12} />Saving...</span>}
        {lastTurn && <span title="From the last reply's trace: which entries went into the prompt and why.">Last turn: {footerLine(lastTurn)}</span>}
      </footer>
    </>
  );
}
