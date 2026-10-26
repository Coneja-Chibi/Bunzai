/**
 * MarinaraFolderToc - the binder TOC with real folders (locked wireframe vs-lore-mari-folders,
 * sections A + B, 1:1). Renders the folder forest projected from canonical categories + escrowed
 * parent edges: collapse hides a subtree, a disabled folder dims everything under it (the approved
 * proposed view), drag re-parents with the engine's three-band split (top third = sibling above,
 * middle = nest, low third = sibling below), and the bottom strip un-nests to the root. Entry rows
 * reuse the shared trow furniture so the lens adds containers, not new row vocabulary.
 */
import { Button, IconButton, Toggle } from "../../../components/button";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type JSX, type KeyboardEvent } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import { estimateEntryTokens, fieldVisible, type LoreWriteForProfile } from "../../../../core/lore";
import { entryFireMode, fireModePatch } from "./entry-fire-mode";
import { ModeSelect } from "./entry-toc-mode";
import {
  buildFolderForest,
  canReparentFolder,
  effectivelyDisabledFolderIds,
  folderCounts,
  type FolderNode,
  type ParentEdges,
} from "./folder-tree";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../../_shared/virtual-list";

type DragPayload = { kind: "entry" | "folder"; id: string } | null;
type Band = "above" | "nest" | "below";
type FolderTocRow =
  | { kind: "root-label"; key: "root-label"; depth: 0 }
  | { kind: "folder"; key: string; node: FolderNode; depth: number }
  | { kind: "entry"; key: string; entry: LorebookEntry; dim: boolean; depth: number; folderId?: string }
  | { kind: "gate"; key: string; depth: number; folderId: string };

function visibleFolderRows(forest: readonly FolderNode[], roots: readonly LorebookEntry[], byFolder: ReadonlyMap<string, readonly LorebookEntry[]>, collapsed: ReadonlySet<string>, gated: ReadonlySet<string>): FolderTocRow[] {
  const rows: FolderTocRow[] = [];
  if (roots.length) rows.push({ kind: "root-label", key: "root-label", depth: 0 });
  for (const entry of roots) rows.push({ kind: "entry", key: `root-entry:${entry.id}`, entry, dim: false, depth: 0 });
  const visit = (node: FolderNode, depth: number): void => {
    const id = node.category.id;
    rows.push({ kind: "folder", key: `folder:${id}`, node, depth });
    if (collapsed.has(id)) return;
    const dim = gated.has(id);
    if (dim) rows.push({ kind: "gate", key: `gate:${id}`, depth: depth + 1, folderId: id });
    for (const entry of byFolder.get(id) ?? []) rows.push({ kind: "entry", key: `entry:${entry.id}`, entry, dim, depth: depth + 1, folderId: id });
    for (const child of node.children) visit(child, depth + 1);
  };
  for (const node of forest) visit(node, 0);
  return rows;
}

export interface FolderTocProps {
  entries: readonly LorebookEntry[];
  categories: readonly LorebookCategory[];
  edges: ParentEdges;
  focusedId: string | null;
  selectedFolderId: string | null;
  collapsed: ReadonlySet<string>;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  bookName: string;
  onSelectEntry: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onPatchEntry: (id: string, patch: Partial<LorebookEntry>) => void;
  onToggleFolderEnabled: (id: string, on: boolean) => void;
  onReparentFolder: (id: string, parent: string | null) => void;
  /** Sibling drop (top/low band): reparent to the anchor's container AND reorder, as one op. */
  onDropFolderSibling: (id: string, anchorId: string, side: "above" | "below") => void;
  onMoveEntryToFolder: (entryId: string, folderId: string | null) => void;
  onAddFolder: () => void;
  onAddEntry: () => void;
}

/** The three-band split the engine reads from the cursor offset on a folder header. */
function bandOf(ev: DragEvent<HTMLElement>): Band {
  const rect = ev.currentTarget.getBoundingClientRect();
  const y = (ev.clientY - rect.top) / Math.max(rect.height, 1);
  return y < 1 / 3 ? "above" : y > 2 / 3 ? "below" : "nest";
}

export function MarinaraFolderToc({
  entries,
  categories,
  edges,
  focusedId,
  selectedFolderId,
  collapsed,
  writeFor,
  styles,
  bookName,
  onSelectEntry,
  onSelectFolder,
  onToggleCollapse,
  onPatchEntry,
  onToggleFolderEnabled,
  onReparentFolder,
  onDropFolderSibling,
  onMoveEntryToFolder,
  onAddFolder,
  onAddEntry,
}: FolderTocProps): JSX.Element {
  const [drag, setDrag] = useState<DragPayload>(null);
  const [over, setOver] = useState<{ folderId: string; band: Band } | null>(null);
  const [rootLive, setRootLive] = useState(false);
  const [dragFocusKey, setDragFocusKey] = useState<string | null>(null);

  const forest = useMemo(() => buildFolderForest(categories, edges), [categories, edges]);
  const gated = useMemo(() => effectivelyDisabledFolderIds(categories, edges), [categories, edges]);
  const counts = useMemo(() => folderCounts(categories, edges, entries), [categories, edges, entries]);
  const knownIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const vectorOk = fieldVisible(writeFor, "vectorized");
  const canMode = fieldVisible(writeFor, "constant");
  const rootEntries = useMemo(() => entries.filter((e) => e.categoryId === null || !knownIds.has(e.categoryId)), [entries, knownIds]);
  const entriesByFolder = useMemo(() => {
    const byFolder = new Map<string, LorebookEntry[]>();
    for (const entry of entries) if (entry.categoryId !== null) {
      const group = byFolder.get(entry.categoryId) ?? [];
      group.push(entry);
      byFolder.set(entry.categoryId, group);
    }
    return byFolder;
  }, [entries]);
  const rows = useMemo(() => visibleFolderRows(forest, rootEntries, entriesByFolder, collapsed, gated), [forest, rootEntries, entriesByFolder, collapsed, gated]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(rows, "marinara-toc", (row) => `${row.kind}:${row.key}`, (row) => row.kind === "entry" ? row.entry : row.kind === "folder" ? row.node.category : row);
  const focusableRows = useMemo(() => rows.flatMap((row, index) => row.kind === "folder" || row.kind === "entry" ? [{ row, index }] : []), [rows]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const keyAtIndex = useCallback((index: number) => rowKeys[index], [rowKeys]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []), keyAtIndex, rowIndex);
  const dragIndex = dragFocusKey === null ? -1 : rowIndex(dragFocusKey);
  const virtualizer = useVirtualRows({
    mode: "variable", count: rows.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!,
    estimateSize: (index) => rows[index]!.kind === "entry" ? 52 : 38,
    rangeExtractor: useCallback((range: Range) => {
      const indexes = keepFocusedInRange(range, focusedIndex);
      return dragIndex < 0 || indexes.includes(dragIndex) ? indexes : [...indexes, dragIndex].sort((a, b) => a - b);
    }, [focusedIndex, dragIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const selectedIndex = rows.findIndex((row) => row.kind === "entry" ? row.entry.id === focusedId : row.kind === "folder" && row.node.category.id === selectedFolderId);
  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;
  useEffect(() => { if (selectedIndex >= 0) scrollToIndexRef.current(selectedIndex, { align: "auto" }); }, [selectedIndex, rowKeys]);
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = document.activeElement?.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    const index = focusableRows.findIndex(({ index: rowIndex }) => rowKeys[rowIndex] === key);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, {
      scrollToIndex: (at, options) => virtualizer.scrollToIndex(focusableRows[at]!.index, options),
    }, focusableRows.length, index, event.currentTarget, (at) => rowKeys[focusableRows[at]!.index]!);
  };

  const clearDrag = (): void => {
    setDrag(null);
    setDragFocusKey(null);
    setOver(null);
    setRootLive(false);
  };

  const dropOnFolder = (folderId: string, band: Band): void => {
    if (!drag) return;
    if (drag.kind === "entry") {
      // an entry drop only ever changes membership; bands reorder folders, not entries
      onMoveEntryToFolder(drag.id, folderId);
    } else if (band === "nest") {
      if (canReparentFolder(edges, drag.id, folderId, knownIds)) onReparentFolder(drag.id, folderId);
    } else if (drag.id !== folderId) {
      onDropFolderSibling(drag.id, folderId, band === "above" ? "above" : "below");
    }
    clearDrag();
  };

  const entryRow = (e: LorebookEntry, dim: boolean, focusKey: string): JSX.Element => {
    const focused = e.id === focusedId;
    const cls = [
      styles.trow,
      focused ? styles.trowOn : "",
      !e.enabled ? styles.trowOff : "",
      dim ? styles.mfDim : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        key={e.id}
        data-pick={focusKey}
        draggable
        onDragStart={(ev) => {
          setDrag({ kind: "entry", id: e.id });
          setDragFocusKey(focusKey);
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", e.id);
        }}
        onDragEnd={clearDrag}
      >
        <div
          role="button"
          tabIndex={0}
          className={cls}
          onClick={() => onSelectEntry(e.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelectEntry(e.id);
            }
          }}
        >
          <Toggle size="sm" on={e.enabled} aria-label={e.enabled ? "Entry on" : "Entry off"} isolate onChange={() => onPatchEntry(e.id, { enabled: !e.enabled })} />
          <div className={styles.tMain}>
            <div className={styles.tTitleRow}>
              <span className={styles.tnm}>{e.title || "(untitled)"}</span>
              <span className={styles.tokc}>~{estimateEntryTokens(e)}</span>
            </div>
            {canMode && (
              <ModeSelect
                mode={entryFireMode(e)}
                vectorOk={vectorOk}
                styles={styles}
                onChange={(m) => onPatchEntry(e.id, fireModePatch(m))}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const folderBlock = (node: FolderNode, focusKey: string): JSX.Element => {
    const c = node.category;
    const isCollapsed = collapsed.has(c.id);
    const count = counts.get(c.id) ?? { entries: 0, folders: 0 };
    const hidden = count.entries + count.folders;
    const overHere = over?.folderId === c.id ? over.band : null;
    const enabled = c.enabled !== false;

    return (
      <div key={c.id}>
        {overHere === "above" && <div className={styles.mfInsert} />}
        <div
          data-pick={focusKey}
          role="button"
          tabIndex={0}
          className={[
            styles.mfFolder,
            selectedFolderId === c.id ? styles.mfFolderSel : "",
            overHere === "nest" ? styles.mfFolderNest : "",
          ]
            .filter(Boolean)
            .join(" ")}
          draggable
          onDragStart={(ev) => {
            setDrag({ kind: "folder", id: c.id });
            setDragFocusKey(focusKey);
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", c.id);
          }}
          onDragEnd={clearDrag}
          onDragOver={(ev) => {
            if (!drag || (drag.kind === "folder" && drag.id === c.id)) return;
            const band = drag.kind === "entry" ? "nest" : bandOf(ev);
            // an illegal nest target (own subtree) never lights up or accepts the drop
            if (
              drag.kind === "folder" &&
              band === "nest" &&
              !canReparentFolder(edges, drag.id, c.id, knownIds)
            ) {
              if (over?.folderId === c.id) setOver(null);
              return;
            }
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            setOver({ folderId: c.id, band });
          }}
          onDragLeave={() => {
            if (over?.folderId === c.id) setOver(null);
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            dropOnFolder(c.id, drag?.kind === "entry" ? "nest" : bandOf(ev));
          }}
          onClick={() => onSelectFolder(c.id)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              onSelectFolder(c.id);
            }
          }}
        >
          <IconButton label={isCollapsed ? "Expand folder" : "Collapse folder"} variant="quiet" size="sm" icon={isCollapsed ? "lucide:chevron-right" : "lucide:chevron-down"} aria-expanded={!isCollapsed} onClick={(ev) => {
              ev.stopPropagation();
              onToggleCollapse(c.id);
            }} />
          <span className={styles.mfDragHandle} title="Drag to move or re-parent" aria-hidden="true">
            {"⠷"}
          </span>
          <span className={styles.mfName}>{c.name || "(unnamed folder)"}</span>
          <span className={styles.mfCount}>
            {isCollapsed ? `${hidden} hidden` : `${count.entries} + ${count.folders}`}
          </span>
          <Toggle size="sm" on={enabled} aria-label={enabled ? "Folder enabled" : "Folder disabled"} title={enabled ? "Folder enabled" : "Folder disabled"} isolate onChange={() => onToggleFolderEnabled(c.id, !enabled)} />
        </div>
        {overHere === "below" && <div className={styles.mfInsert} />}
      </div>
    );
  };

  return (
    <aside className={`${styles.toc} ${styles.mfToc}`} aria-label="Folders and entries">
      <p className={styles.tocTitle}>
        {bookName || "Contents"}
        <span className={styles.gcount} style={{ marginLeft: "auto" }}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · {categories.length}{" "}
          {categories.length === 1 ? "folder" : "folders"}
        </span>
      </p>

      <div className={styles.mfItems} ref={scrollRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <div className={styles.mfSpace} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            const focusable = row.kind === "folder" || row.kind === "entry";
            const nested = row.depth > 0;
            const parentTarget = row.kind === "entry" && row.folderId && over?.folderId === row.folderId && over.band === "nest";
            return (
              <div
                key={rowKeys[item.index]}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-pick={focusable ? rowKeys[item.index] : undefined}
                className={`${styles.mfVirtualRow}${nested ? ` ${styles.mfNested}` : ""}${parentTarget ? ` ${styles.mfBodyTarget}` : ""}`}
                style={{ transform: `translateY(${String(item.start)}px)`, "--mf-depth": row.depth } as CSSProperties}
              >
                {row.kind === "root-label" ? <div className={styles.mfRootLab}>Loose at the root</div>
                  : row.kind === "folder" ? folderBlock(row.node, rowKeys[item.index]!)
                    : row.kind === "entry" ? entryRow(row.entry, row.dim, rowKeys[item.index]!)
                      : <p className={styles.mfGateNote}>folder off - nothing inside fires, own toggles kept</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={rootLive ? `${styles.mfDropStrip} ${styles.mfDropStripLive}` : styles.mfDropStrip}
        onDragOver={(ev) => {
          if (!drag) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          setRootLive(true);
        }}
        onDragLeave={() => setRootLive(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          if (drag?.kind === "entry") onMoveEntryToFolder(drag.id, null);
          else if (drag) onReparentFolder(drag.id, null);
          clearDrag();
        }}
      >
        Drop an entry or folder here to send it to the top level
      </div>

      <div className={styles.mfAddRow}>
        <Button size="sm" block onClick={onAddFolder}>+ New folder</Button>
        <Button size="sm" block onClick={onAddEntry}>+ New entry</Button>
      </div>
    </aside>
  );
}
