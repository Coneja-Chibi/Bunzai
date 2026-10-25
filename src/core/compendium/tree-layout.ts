/**
 * A stored layout shown as the Compendium's tree, and the two things a person does to a tree by hand (04b D3, Track D): file an
 * entry under another entry (a pin) and drop an entry on a branch. The layout is what a model built from the book's entries and the
 * scene stored (ChatStore rule 40); it covers every entry but the recaps, which stay the live Narrative branch because the historian
 * writes them all the time. An entry the book gained since the build shows under "Added since the last build" instead of vanishing;
 * one the book lost or switched off drops out. Pins are applied over the derived tree and a stored one alike, so they are the same
 * pass RoleCall runs (`tv-tree-typed.ts:735+`) without a stored copy. Pure.
 */
import type { LorebookCategory } from "../../entities/lorebook/schema";
import type { LayoutNode, StoredLayout } from "../../stage/contracts/chat-tree-types";
import type { CompendiumEntry } from "./read";
import { buildTree, narrativeBucket, treeStats, type CompendiumTree, type TreeNode } from "./tree";

/** An entry the layout covers: live, and not a recap or an arc overview (those are the Narrative branch). */
export const categorizable = (e: CompendiumEntry): boolean => e.enabled && !e.retired && e.type !== "summary" && e.arc === null;
const narrative = (e: CompendiumEntry): boolean => e.enabled && !e.retired && (e.type === "summary" || e.arc !== null);

export const ADDED_NODE = "n:added";
const sum = (nodes: readonly TreeNode[]): number => nodes.reduce((n, c) => n + c.entryCount, 0);

export function layoutToTree(layout: StoredLayout, entries: readonly CompendiumEntry[]): CompendiumTree {
  const live = new Map(entries.filter(categorizable).map((e) => [e.id, e]));
  const placed = new Set<string>();
  const convert = (n: LayoutNode): TreeNode | null => {
    const children = n.children.flatMap((c) => convert(c) ?? []);
    const entryIds = n.entryIds.filter((id) => live.has(id) && !placed.has(id));
    for (const id of entryIds) placed.add(id);
    return entryIds.length === 0 && children.length === 0 ? null : { id: n.id, label: n.label, summary: n.summary, entryIds, children, entryCount: entryIds.length + sum(children) };
  };
  const children = layout.root.children.flatMap((c) => convert(c) ?? []);
  const added = [...live.keys()].filter((id) => !placed.has(id));
  if (added.length > 0) children.push({ id: ADDED_NODE, label: "Added since the last build", summary: `${added.length} entries the book gained after the tree was built`, entryIds: added, children: [], entryCount: added.length });
  const recaps = entries.filter(narrative);
  if (recaps.length > 0) children.push(narrativeBucket(recaps));
  const root: TreeNode = { id: "root", label: "World Knowledge", summary: layout.root.summary, entryIds: [], children, entryCount: sum(children) };
  return { typed: false, stored: true, root, stats: treeStats(root) };
}

const recount = (node: TreeNode): number => (node.entryCount = node.entryIds.length + node.children.reduce((n, c) => n + recount(c), 0));

/** RoleCall's pin pass: each pinned entry leaves its branch and sits in a "Pinned" branch under the one holding its target. A pin to a missing entry, to itself, or into the branch it is already in changes nothing. */
export function applyPins(tree: CompendiumTree, pins: Readonly<Record<string, string>> | undefined): CompendiumTree {
  const entries = Object.entries(pins ?? {});
  if (entries.length === 0) return tree;
  const root = structuredClone(tree.root);
  const home = new Map<string, TreeNode>();
  const index = (n: TreeNode): void => { for (const id of n.entryIds) home.set(id, n); n.children.forEach(index); };
  index(root);
  for (const [id, targetId] of entries) {
    const from = home.get(id);
    const to = home.get(targetId);
    if (!from || !to || id === targetId || from === to) continue;
    let box = to.children.find((c) => c.kind === "pinned");
    if (!box) {
      box = { id: `pinned:${to.id}`, label: "Pinned", summary: "Entries you manually moved here.", entryIds: [], children: [], entryCount: 0, kind: "pinned" };
      to.children.push(box);
    }
    from.entryIds = from.entryIds.filter((e) => e !== id);
    box.entryIds.push(id);
    home.set(id, box);
  }
  recount(root);
  return { ...tree, root, stats: treeStats(root) };
}

/** The tree the page shows: the stored layout when the scene has one, else the derived tree, with the person's pins over either. */
export function resolveTree(entries: readonly CompendiumEntry[], categories: readonly LorebookCategory[], layout: StoredLayout | null, pins?: Readonly<Record<string, string>>): CompendiumTree {
  return applyPins(layout ? layoutToTree(layout, entries) : buildTree(entries, categories), pins);
}

/** The layout with `entryId` filed under the branch `nodeId` (taken from wherever it was); null when the layout has no such branch. The root is not a branch to drop on. */
export function moveInLayout(layout: StoredLayout, entryId: string, nodeId: string): StoredLayout | null {
  const next = structuredClone(layout);
  let target: LayoutNode | undefined;
  const walk = (n: LayoutNode): void => {
    n.entryIds = n.entryIds.filter((id) => id !== entryId);
    if (n.id === nodeId && n !== next.root) target = n;
    n.children.forEach(walk);
  };
  walk(next.root);
  if (!target) return null;
  (target as LayoutNode).entryIds.push(entryId);
  return next;
}

/** The words for every branch of the tree the page shows and every entry of the book, by id: what the Settings list names a saved choice by. */
export function withLabels(entries: readonly CompendiumEntry[], categories: readonly LorebookCategory[], layout: StoredLayout | null, pins?: Readonly<Record<string, string>>): Map<string, { label: string; entry: boolean }> {
  const out = new Map<string, { label: string; entry: boolean }>();
  const walk = (n: TreeNode): void => { out.set(n.id, { label: n.label, entry: false }); n.children.forEach(walk); };
  walk(resolveTree(entries, categories, layout, pins).root);
  for (const e of entries) out.set(e.id, { label: e.name, entry: true });
  return out;
}
