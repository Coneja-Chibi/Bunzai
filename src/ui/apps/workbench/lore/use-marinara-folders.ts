/**
 * useMarinaraFolders - binder state for the Marinara folder lens (locked vs-lore-mari-folders).
 * Parent edges live only in the escrowed envelope; canonical categories stay flat. Owns edge
 * folder projection, TOC props, and inspector handlers; accepted edge state lives in LoreSession.
 */
import { useCallback, useMemo, useState, type SetStateAction } from "react";
import type { LorebookCategory, LorebookEntry } from "../../../../entities/lorebook/schema";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { LoreWriteForProfile } from "../../../../core/lore";
import { addEntry, selectEntry, updateEntry, type LoreSession } from "./session";
import type { FolderTocProps } from "./folder-toc";
import type { FolderInspectorProps } from "./folder-inspector";
import {
  addFolder,
  cloneFolder,
  deleteFolderPromote,
  patchCategory,
  reorderSiblingFolder,
  reparentFolder,
} from "./folder-tree";
import type { EditorTouch } from "../../../_shared/editor-state";
import type { OccurrenceIndex } from "../../../_shared/editor-state";
import { loreCategoryTouch, loreEntryTouch } from "./session";


export interface MarinaraFoldersApi {
  edgesDirty: boolean;
  captureEdges: () => ReadonlyMap<string, string | null>;
  /** Accept exactly the map a successful save wrote; newer edge edits remain dirty. */
  markEdgesSaved: (snapshot: ReadonlyMap<string, string | null>) => void;
  reseedEdges: (edges: ReadonlyMap<string, string | null>, categories: readonly LorebookCategory[]) => void;
  folderLens: boolean;
  selectedFolder: LorebookCategory | undefined;
  folderProps: FolderTocProps;
  inspectorProps: FolderInspectorProps | null;
}

export function useMarinaraFolders(opts: {
  session: LoreSession;
  setSession(update: SetStateAction<LoreSession>, touch?: EditorTouch<LorebookBody>, record?: boolean): void;
  writeFor: LoreWriteForProfile;
  styles: Readonly<Record<string, string>>;
  entryIndex: OccurrenceIndex<LorebookEntry>;
}): MarinaraFoldersApi {
  const { session, setSession, writeFor, styles, entryIndex } = opts;
  const edges = session.edges;
  const setEdges = useCallback((update: SetStateAction<Map<string, string | null>>): void => {
    const before = session.edges;
    const next = typeof update === "function" ? update(before) : update;
    if (next === before || (next.size === before.size && [...next].every(([id, parent]) => before.get(id) === parent))) return;
    setSession((current) => ({ ...current, edges: next }));
  }, [session.edges, setSession]);
  const [edgesBaseline, setEdgesBaseline] = useState<Map<string, string | null>>(
    () => new Map(edges),
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set());

  const edgesDirty = useMemo(() => {
    if (edges.size !== edgesBaseline.size) return true;
    for (const [k, v] of edges) {
      if (!edgesBaseline.has(k) || edgesBaseline.get(k) !== v) return true;
    }
    return false;
  }, [edges, edgesBaseline]);

  const folderLens = writeFor === "marinara";
  const categories = session.body.categories ?? [];
  const selectedFolder = selectedFolderId
    ? categories.find((c) => c.id === selectedFolderId)
    : undefined;

  const toggleCollapse = (id: string): void => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const folderProps: FolderTocProps = {
    entries: session.body.entries,
    categories,
    edges,
    focusedId: session.focusedId,
    selectedFolderId,
    collapsed: collapsedFolders,
    writeFor,
    styles,
    bookName: session.body.name,
    onSelectEntry: (id: string) => {
      setSelectedFolderId(null);
      setSession((s) => selectEntry(s, id));
    },
    onSelectFolder: (id: string) => setSelectedFolderId(id),
    onToggleCollapse: toggleCollapse,
    onPatchEntry: (id: string, patch: Partial<LorebookEntry>) =>
      setSession((s) => updateEntry(s, id, patch), loreEntryTouch(id, entryIndex)),
    onToggleFolderEnabled: (id: string, on: boolean) =>
      setSession((s) => ({ ...s, body: patchCategory(s.body, id, { enabled: on }) }), loreCategoryTouch(id)),
    onReparentFolder: (id: string, parent: string | null) =>
      setEdges((prev) => reparentFolder(prev, categories, id, parent)),
    onDropFolderSibling: (id: string, anchorId: string, side: "above" | "below") => {
      const anchorParent = edges.get(anchorId) ?? null;
      const nextEdges = reparentFolder(edges, categories, id, anchorParent);
      if ((nextEdges.get(id) ?? null) !== anchorParent) return;
      setSession((s) => ({
        ...s,
        edges: nextEdges,
        body: reorderSiblingFolder(s.body, nextEdges, id, anchorId, side),
      }));
    },
    onMoveEntryToFolder: (entryId: string, folderId: string | null) =>
      setSession((s) => updateEntry(s, entryId, { categoryId: folderId }), loreEntryTouch(entryId, entryIndex)),
    onAddFolder: () => {
      const out = addFolder(session.body, edges, "New folder");
      setSession((s) => ({ ...s, edges: out.edges, body: { ...s.body, categories: out.body.categories } }));
      setSelectedFolderId(out.id);
    },
    onAddEntry: () => {
      setSelectedFolderId(null);
      setSession((s) => addEntry(s));
    },
  };

  const inspectorProps: FolderInspectorProps | null = selectedFolder
    ? {
        category: selectedFolder,
        categories,
        edges,
        collapsed: collapsedFolders.has(selectedFolder.id),
        styles,
        onRename: (name: string) =>
          setSession((s) => ({
            ...s,
            body: patchCategory(s.body, selectedFolder.id, { name }),
          }), loreCategoryTouch(selectedFolder.id)),
        onMove: (parent: string | null) =>
          setEdges((prev) => reparentFolder(prev, categories, selectedFolder.id, parent)),
        onToggleEnabled: (on: boolean) =>
          setSession((s) => ({
            ...s,
            body: patchCategory(s.body, selectedFolder.id, { enabled: on }),
          }), loreCategoryTouch(selectedFolder.id)),
        onClone: () => {
          const out = cloneFolder(session.body, edges, selectedFolder.id);
          setSession((s) => ({ ...s, edges: out.edges, body: out.body }));
        },
        onToggleCollapse: () => toggleCollapse(selectedFolder.id),
        onDeletePromote: () => {
          const out = deleteFolderPromote(session.body, edges, selectedFolder.id);
          setSession((s) => ({ ...s, edges: out.edges, body: out.body }));
          setSelectedFolderId(null);
        },
      }
    : null;

  const captureEdges = useCallback((): ReadonlyMap<string, string | null> => new Map(edges), [edges]);

  const markEdgesSaved = useCallback((snapshot: ReadonlyMap<string, string | null>): void => {
    setEdgesBaseline(new Map(snapshot));
  }, []);

  const reseedEdges = useCallback((fresh: ReadonlyMap<string, string | null>, freshCategories: readonly LorebookCategory[]): void => {
    const accepted = new Map(fresh);
    setSession((current) => ({ ...current, edges: accepted }), undefined, false);
    const ids = new Set(freshCategories.map(({ id }) => id));
    setSelectedFolderId((id) => id && ids.has(id) ? id : null);
    setCollapsedFolders((prior) => new Set([...prior].filter((id) => ids.has(id))));
    setEdgesBaseline(accepted);
  }, [setSession]);

  return {
    edgesDirty,
    captureEdges,
    markEdgesSaved,
    reseedEdges,
    folderLens,
    selectedFolder,
    folderProps,
    inspectorProps,
  };
}
