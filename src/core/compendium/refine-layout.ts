/**
 * Brings a built layout up to date with what Refine did to the book (RoleCall edits the leaf node in place after each operation,
 * `tv-tree-llm.ts` `node.entryIds`): an entry that was merged away leaves its branch, and an entry split off sits in the branch of its
 * source, so neither shows under "Added since the last build". The layout's revision becomes the book's after the write. Pure.
 */
import type { LayoutNode, StoredLayout } from "../../stage/contracts/chat-tree-types";

export function applyRefined(layout: StoredLayout, made: ReadonlyMap<string, string>, gone: ReadonlySet<string>, rev: string): StoredLayout {
  const root = structuredClone(layout.root);
  const visit = (n: LayoutNode): void => {
    const before = n.entryIds;
    n.entryIds = before.filter((id) => !gone.has(id));
    for (const [id, source] of made) if (before.includes(source) && !n.entryIds.includes(id)) n.entryIds.push(id);
    n.children.forEach(visit);
  };
  visit(root);
  return { ...layout, rev, root };
}
