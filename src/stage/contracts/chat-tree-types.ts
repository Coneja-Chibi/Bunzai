/**
 * A stored Compendium tree layout: the tree a model built from a book's entries, kept with
 * the scene beside the book and never inside it (04b F3). Split from chat-store.ts for the file-size cap; chat-store.ts re-exports.
 */

/** One branch of a stored layout. `id` is stable across builds (a path of the branch's names), so a person's choices about it survive a rebuild. */
export interface LayoutNode {
  id: string;
  label: string;
  summary: string;
  /** The entries filed directly under this branch. */
  entryIds: string[];
  children: LayoutNode[];
}

export interface StoredLayout {
  /** The book revision the layout was built from. */
  rev: string;
  /** The model that built it, or "manual" for a layout that only holds a person's move. */
  model: string;
  granularity: 0 | 1 | 2 | 3 | 4;
  detail: "names" | "lite" | "full";
  /** The root branch "World Knowledge"; its summary is the model's description of the world. */
  root: LayoutNode;
}

/** Whether a layout still shows (`live`) or was taken back by Undo (`undone`). A layout is never deleted. */
export type TreeStatus = "live" | "undone";

export interface StoredTree {
  id: string;
  chatId: string;
  bookId: string;
  /** Epoch ms the layout was stored. */
  at: number;
  status: TreeStatus;
  layout: StoredLayout;
}

/** The most UTF-8 bytes of JSON one stored layout may hold. */
export const TREE_MAX_BYTES = 1024 * 1024;
export const TREE_MAX_NODES = 3_000;
export const TREE_MAX_DEPTH = 8;
