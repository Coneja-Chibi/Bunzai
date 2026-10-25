/**
 * Turns a model's categories into the layout to store, then holds it to what the person asked for (04b Track D; RoleCall asks the
 * model to respect Lock, Forbid and Reorganize and trusts it, `constraint-helpers.ts`). Here the prompt says it and this checks it:
 * a locked branch comes back exactly as the last layout had it, a locked entry stays in its branch, a forbidden branch is dissolved
 * into its parent, a forbidden entry is left unsorted, and every entry lands exactly once (one the model left out goes to General).
 * Branch ids are a path of names, so a choice about a branch survives a rebuild that keeps its name. Pure; nothing is stored here.
 */
import type { ChatCompendiumTreeConstraints } from "../../stage/contracts/chat-settings-types";
import type { LayoutNode, StoredLayout } from "../../stage/contracts/chat-tree-types";
import type { CompendiumEntry } from "./read";
import type { RawCategory } from "./tree-llm";

export interface AssembleInput {
  answer: { summary: string; categories: readonly RawCategory[] };
  /** The entries the model numbered, in that order. */
  entries: readonly CompendiumEntry[];
  previous: StoredLayout | null;
  constraints: ChatCompendiumTreeConstraints;
  meta: Pick<StoredLayout, "rev" | "model" | "granularity" | "detail">;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "x";
const node = (id: string, label: string, summary: string, entryIds: string[] = [], children: LayoutNode[] = []): LayoutNode => ({ id, label, summary, entryIds, children });

function toNodes(cs: readonly RawCategory[], ids: readonly string[], parent: string, taken: Set<string>): LayoutNode[] {
  return cs.map((c) => {
    const at = (suffix: string) => (parent ? `${parent}/${slug(c.name)}${suffix}` : `n:${slug(c.name)}${suffix}`);
    let id = at("");
    for (let n = 2; taken.has(id); n++) id = at(`-${n}`);
    taken.add(id);
    return node(id, c.name, c.summary, c.entries.map((i) => ids[i]!), toNodes(c.children, ids, id, taken));
  });
}

const walk = (n: LayoutNode, f: (n: LayoutNode, parent: LayoutNode | null) => void, parent: LayoutNode | null = null): void => { f(n, parent); n.children.forEach((c) => walk(c, f, n)); };
const entriesOf = (n: LayoutNode): string[] => [...n.entryIds, ...n.children.flatMap(entriesOf)];
const strip = (n: LayoutNode, gone: ReadonlySet<string>): void => { n.entryIds = n.entryIds.filter((id) => !gone.has(id)); n.children.forEach((c) => strip(c, gone)); };
/** The branch without entries the book lost, or null when nothing is left of it. */
const prune = (n: LayoutNode, live: ReadonlySet<string>): LayoutNode | null => {
  const children = n.children.flatMap((c) => prune(c, live) ?? []);
  const entryIds = n.entryIds.filter((id) => live.has(id));
  return entryIds.length === 0 && children.length === 0 ? null : { ...n, entryIds, children };
};

/** A forbidden branch's entries (and those of forbidden branches below it) go up to the nearest branch that stays; `hoist` is what a top-level one leaves over. */
function dissolve(n: LayoutNode, forbidden: ReadonlySet<string>): { nodes: LayoutNode[]; hoist: string[] } {
  const below = n.children.map((k) => dissolve(k, forbidden));
  const nodes = below.flatMap((r) => r.nodes);
  const hoist = below.flatMap((r) => r.hoist);
  return forbidden.has(n.id) ? { nodes, hoist: [...n.entryIds, ...hoist] } : { nodes: [{ ...n, entryIds: [...n.entryIds, ...hoist], children: nodes }], hoist: [] };
}

export function assembleLayout(input: AssembleInput): { layout: StoredLayout; notes: string[] } {
  const { entries, previous, constraints: c } = input;
  const live = new Set(entries.map((e) => e.id));
  const ids = entries.map((e) => e.id);
  const notes: string[] = [];
  const root = node("root", "World Knowledge", input.answer.summary, [], toNodes(input.answer.categories, ids, "", new Set(["n:general", "n:unsorted"])));

  // A forbidden entry is not placed where the model put it.
  const forbiddenEntries = new Set((c.forbidden ?? []).filter((id) => live.has(id)));
  strip(root, forbiddenEntries);

  if (previous) {
    // A locked branch comes back as the last layout had it, minus entries the book lost.
    const prev = structuredClone(previous.root);
    const locked = new Set(c.locked ?? []);
    const kept: { node: LayoutNode; parentId: string }[] = [];
    const find = (n: LayoutNode): void => n.children.forEach((k) => {
      const p = locked.has(k.id) ? prune(k, live) : undefined;
      if (p) kept.push({ node: p, parentId: n.id });
      if (!locked.has(k.id)) find(k);
    });
    find(prev);
    const claimed = new Set(kept.flatMap((k) => entriesOf(k.node)));
    strip(root, claimed);
    for (const { node: n, parentId } of kept) {
      let replaced = false;
      walk(root, (at, parent) => { if (!replaced && parent && at.id === n.id) { parent.children[parent.children.indexOf(at)] = n; replaced = true; } });
      if (replaced) continue;
      let home = root;
      walk(root, (at) => { if (at.id === parentId) home = at; });
      home.children.push(n);
    }
    // A locked entry goes back to the branch it was in, when that branch is still there.
    const byId = new Map<string, LayoutNode>();
    walk(root, (n) => byId.set(n.id, n));
    walk(prev, (n) => {
      const home = byId.get(n.id);
      for (const id of n.entryIds) {
        if (!home || !locked.has(id) || !live.has(id) || forbiddenEntries.has(id) || claimed.has(id)) continue;
        strip(root, new Set([id]));
        home.entryIds.push(id);
      }
    });
  }

  // A forbidden branch is dissolved into its parent; a top-level one leaves its entries to General.
  const forbidden = new Set(c.forbidden ?? []);
  const hoisted = new Set<string>();
  root.children = root.children.flatMap((k) => { const r = dissolve(k, forbidden); r.hoist.forEach((id) => hoisted.add(id)); return r.nodes; });

  // Every entry exactly once: the first place wins, and what is not placed goes to General.
  const seen = new Set<string>();
  walk(root, (n) => { n.entryIds = n.entryIds.filter((id) => live.has(id) && !forbiddenEntries.has(id) && !seen.has(id) && (seen.add(id), true)); });
  const unplaced = ids.filter((id) => !seen.has(id) && !forbiddenEntries.has(id));
  const leftOut = unplaced.filter((id) => !hoisted.has(id));
  if (leftOut.length > 0) notes.push(`${leftOut.length} ${leftOut.length === 1 ? "entry was" : "entries were"} left out of the model's answer and filed under General`);
  if (unplaced.length > 0) root.children.push(node("n:general", "General", "Entries that fit no other branch.", unplaced));
  if (forbiddenEntries.size > 0) root.children.push(node("n:unsorted", "Unsorted", "Entries you forbade from the tree.", [...forbiddenEntries]));

  const trim = (n: LayoutNode): LayoutNode | null => { const children = n.children.flatMap((k) => trim(k) ?? []); return n.entryIds.length === 0 && children.length === 0 ? null : { ...n, children }; };
  root.children = root.children.flatMap((k) => trim(k) ?? []);
  return { layout: { ...input.meta, root }, notes };
}
