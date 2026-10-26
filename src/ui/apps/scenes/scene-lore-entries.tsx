/**
 * The World wing's entries panel for one open book (RoleCall's LorebookEntriesPanel and
 * MiniEntryItem): the action row (saving state, "+" New entry, open in the Workbench) over the
 * search, then the Constant and Selective list beside the editor pane the wing hands in. The list is
 * virtualized (RoleCall mounts every row, each with its own menu; a 213-entry book mounts about a
 * dozen) with the shared virtualizer, so a book of any size scrolls as fast as a short one. Each
 * row's "..." menu is one shared popover (Open and edit, Disable/Enable, Move up/down, Delete), drawn
 * inside the wing so no scroll box clips it.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { LorebookEntry } from "../../../entities/lorebook/schema";
import type { SceneLoreFired } from "../../app-contract-scenes";
import { InkDialog } from "../../components/ink-dialog";
import { Button, Disclosure, IconButton, MenuItem, Scrim } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { useEscapeKey } from "../../_shared/use-escape-key";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, useFocusedRangeIndex, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { entryMatches, entryTokens, fireLabel, type FireLabel } from "./lore-core";
import { LastTurnFoot } from "./scene-lore-books";

type Group = "constant" | "selective";
type Row =
  | { kind: "head"; key: string; group: Group; count: number; open: boolean }
  | { kind: "entry"; key: string; entry: LorebookEntry };
const HEAD_PX = 34;
const ENTRY_PX = 64;

const bySortOrder = (a: LorebookEntry, b: LorebookEntry): number => a.sortOrder - b.sortOrder;

const EntryRow = memo(function EntryRow({ entry, selected, fire, onSelect, onMenu }: {
  entry: LorebookEntry;
  selected: boolean;
  fire: FireLabel | null;
  onSelect(id: string): void;
  onMenu(id: string, trigger: HTMLElement): void;
}): JSX.Element {
  const title = entry.title || "Untitled";
  return (
    <div className={`wl-en${selected ? " sel" : ""}${entry.enabled ? "" : " off"}`} role="button" tabIndex={0}
      onClick={() => onSelect(entry.id)} onKeyDown={(e: KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(entry.id); } }}>
      <div className="wl-en-r">
        <span className="wl-en-n">{title}</span>
        {fire && <span className={`wl-why ${fire.cls}`}>{fire.text}</span>}
        <IconButton variant="quiet" size="sm" label={`Actions for ${title}`} aria-haspopup="menu" icon="lucide:ellipsis-vertical"
          onClick={(e) => { e.stopPropagation(); onMenu(entry.id, e.currentTarget); }} />
      </div>
      <div className="wl-en-t">~{entryTokens(entry)}</div>
    </div>
  );
});

export interface EntryActions {
  onSelect(id: string): void;
  onToggleEnabled(id: string): void;
  onMove(id: string, direction: "up" | "down"): void;
  onDeleteRequest(id: string): void;
}

/** The shared "..." popover: positioned against the wing root from the pressed button, flipping up near the bottom. */
function EntryMenu({ entry, anchor, host, atTop, atBottom, actions, onClose }: {
  entry: LorebookEntry;
  anchor: HTMLElement;
  host: HTMLElement;
  atTop: boolean;
  atBottom: boolean;
  actions: EntryActions;
  onClose(): void;
}): JSX.Element {
  useEscapeKey(onClose, true);
  const a = anchor.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  const down = a.bottom + 240 <= h.bottom;
  const style = { right: Math.max(8, h.right - a.right), ...(down ? { top: a.bottom - h.top + 4 } : { bottom: h.bottom - a.top + 4 }) };
  const run = (fn: () => void) => (): void => { onClose(); fn(); };
  return createPortal(
    <>
      <Scrim transparent data-part="scene.lore.menu-away" label="Close entry actions" tabIndex={-1} onClick={onClose} />
      <div className="wl-menu" role="menu" aria-label={`Entry actions for ${entry.title || "Untitled"}`} style={style}>
        <MenuItem icon="lucide:pencil" onClick={run(() => actions.onSelect(entry.id))}>Open and edit</MenuItem>
        <MenuItem icon="lucide:power" onClick={run(() => actions.onToggleEnabled(entry.id))}>{entry.enabled ? "Disable entry" : "Enable entry"}</MenuItem>
        <div className="two">
          <MenuItem icon="lucide:arrow-up" disabled={atTop} onClick={run(() => actions.onMove(entry.id, "up"))}>Move up</MenuItem>
          <MenuItem icon="lucide:arrow-down" disabled={atBottom} onClick={run(() => actions.onMove(entry.id, "down"))}>Move down</MenuItem>
        </div>
        <div {...protect("entry-delete")}><MenuItem danger icon="lucide:trash-2" onClick={run(() => actions.onDeleteRequest(entry.id))}>Delete entry</MenuItem></div>
      </div>
    </>,
    host,
  );
}

export function EntriesPanel({ entries, selectedId, query, onQuery, bookId, lastTurn, saving, host, actions, onAddEntry, onOpenBook, children }: {
  entries: readonly LorebookEntry[];
  selectedId: string | null;
  query: string;
  onQuery(q: string): void;
  bookId: string;
  lastTurn: { fired: SceneLoreFired[]; totalTokens: number } | null;
  /** A save is waiting or in flight. */
  saving: boolean;
  /** The wing root: the menu draws inside it and is placed against it. */
  host: RefObject<HTMLElement | null>;
  actions: EntryActions;
  onAddEntry(): void;
  onOpenBook(): void;
  /** The editor, or its placeholder. */
  children: JSX.Element;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState<ReadonlySet<Group>>(new Set());
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { rows, position } = useMemo(() => {
    const constant = entries.filter((e) => e.constant).sort(bySortOrder);
    const selective = entries.filter((e) => !e.constant).sort(bySortOrder);
    const place = new Map<string, { top: boolean; bottom: boolean }>();
    for (const g of [constant, selective]) g.forEach((e, i) => place.set(e.id, { top: i === 0, bottom: i === g.length - 1 }));
    const out: Row[] = [];
    for (const [group, list] of [["constant", constant], ["selective", selective]] as const) {
      const shown = list.filter((e) => entryMatches(e, query));
      if (shown.length === 0) continue;
      const open = !collapsed.has(group);
      out.push({ kind: "head", key: `head:${group}`, group, count: shown.length, open });
      if (open) for (const entry of shown) out.push({ kind: "entry", key: entry.id, entry });
    }
    return { rows: out, position: place };
  }, [entries, query, collapsed]);

  const fired = useMemo(() => new Map(lastTurn ? lastTurn.fired.filter((f) => f.bookId === bookId).map((f) => [f.entryId, f]) : []), [lastTurn, bookId]);

  const flatIndexOfFocused = useCallback((target: HTMLElement) => {
    const at = target.closest<HTMLElement>("[data-index]")?.dataset["index"];
    return at === undefined ? -1 : Number(at);
  }, []);
  const identity = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, identity);
  const virtualizer = useVirtualRows({
    mode: "list",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (i) => rows[i]!.key,
    estimateSize: (i) => (rows[i]!.kind === "head" ? HEAD_PX : ENTRY_PX),
    overscan: OVERSCAN,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });

  // A menu whose entry is gone (deleted, or the book reloaded) closes rather than pointing at nothing.
  useEffect(() => { if (menu && !entries.some((e) => e.id === menu.id)) setMenu(null); }, [entries, menu]);
  const openMenu = useCallback((id: string, anchor: HTMLElement) => setMenu((m) => (m?.id === id ? null : { id, anchor })), []);
  const menuEntry = menu ? entries.find((e) => e.id === menu.id) : undefined;
  const hostEl = host.current;

  return (
    <div className="wl-ents" data-part="scene.world.entries">
      <div className="wl-ar">
        <div className="wl-ar-r">
          {saving && <span className="wl-sv"><Ic name="lucide:loader-circle" size={12} />Saving...</span>}
          <IconButton size="sm" label="New entry" icon="lucide:plus" onClick={onAddEntry} />
          <IconButton variant="quiet" size="sm" label="Open full editor" icon="lucide:external-link" onClick={onOpenBook} />
        </div>
        <label className="wl-se">
          <Ic name="lucide:search" size={16} />
          <input type="search" value={query} placeholder="Search entries, text, or triggers..." aria-label="Search lorebook entries" onChange={(e) => onQuery(e.target.value)} />
          {query && <Button variant="quiet" size="sm" onClick={() => onQuery("")}>Clear</Button>}
        </label>
      </div>
      <div className="wl-split" data-open={selectedId !== null}>
        <div className="wl-list">
          <div className="wl-scroll" ref={scrollRef} onFocus={onFocus}
            onKeyDown={(ev) => {
              const flat = flatIndexOfFocused(ev.target as HTMLElement);
              if (flat >= 0) bridgeTabAcrossVirtualBoundary(ev, virtualizer, rows.length, flat, ev.currentTarget, (i) => rows[i]!.key);
            }}>
            <div className="wl-inner" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((v) => {
                const row = rows[v.index];
                if (!row) return null;
                return (
                  <div key={row.key} data-index={v.index} data-pick={row.key} className="wl-vr" style={{ transform: `translateY(${String(v.start)}px)` }}>
                    {row.kind === "head" ? (
                      <Disclosure data-part="scene.lore.group-head" open={row.open} label={row.group === "constant" ? "Constant" : "Selective"} summary={row.count}
                        onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(row.group)) n.delete(row.group); else n.add(row.group); return n; })} />
                    ) : (
                      <EntryRow entry={row.entry} selected={row.entry.id === selectedId} fire={fired.has(row.entry.id) ? fireLabel(fired.get(row.entry.id)!) : null}
                        onSelect={actions.onSelect} onMenu={openMenu} />
                    )}
                  </div>
                );
              })}
            </div>
            {entries.length === 0 && (
              <div className="wl-lempty"><span className="box"><Ic name="lucide:book" size={20} /></span><b>No entries</b><small>This lorebook is empty.</small>
                <Button size="sm" icon="lucide:plus" onClick={onAddEntry}>Add entry</Button></div>
            )}
            {entries.length > 0 && rows.length === 0 && (
              <div className="wl-lempty"><span className="box"><Ic name="lucide:search" size={20} /></span><b>No matching entries</b>
                <Button size="sm" onClick={() => onQuery("")}>Clear search</Button></div>
            )}
          </div>
          <LastTurnFoot lastTurn={lastTurn} />
        </div>
        <div className="wl-detail">{children}</div>
      </div>
      {menu && menuEntry && hostEl && (
        <EntryMenu entry={menuEntry} anchor={menu.anchor} host={hostEl} atTop={position.get(menu.id)?.top ?? true} atBottom={position.get(menu.id)?.bottom ?? true}
          actions={actions} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

/** The editor pane while no entry is open (RoleCall's "Select an Entry" and "Empty Lorebook"). */
export function DetailHint({ empty, onAdd }: { empty: boolean; onAdd(): void }): JSX.Element {
  return (
    <div className="wl-pick"><div>
      <span className="box"><Ic name="lucide:book" size={24} /></span>
      <b>{empty ? "Empty Lorebook" : "Select an Entry"}</b>
      <small>{empty ? "Add an entry to start feeding world details into the scene." : "Pick one from the list to edit its content, triggers, and placement."}</small>
      {empty && <Button variant="primary" icon="lucide:plus" onClick={onAdd}>Add your first entry</Button>}
    </div></div>
  );
}

export function DeleteEntryDialog({ title, onCancel, onConfirm }: { title: string; onCancel(): void; onConfirm(): void }): JSX.Element {
  return (
    <InkDialog onDismiss={onCancel} ariaLabel="Delete this entry">
      <div className="scn-sheet">
        <header className="hd"><div className="eb">World Info</div><h2>Delete this entry</h2><p>{title || "Untitled"}</p></header>
        <div className="bd"><p>This removes it from the book. The library keeps versions, so you can recover it there.</p></div>
        <footer className="ft"><Button autoFocus onClick={onCancel}>Keep entry</Button><Button variant="danger" onClick={onConfirm}>Delete entry</Button></footer>
      </div>
    </InkDialog>
  );
}
