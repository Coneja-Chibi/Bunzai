/**
 * The three Catalogue lists as flat row arrays (RoleCall `ByTypeView.tsx`, `TreeFirstView.tsx`, `SummariesView.tsx`), so one
 * virtual list draws any of them and a 213-entry book mounts a screenful. Pure: the same book, query and open set give the
 * same rows. Untyped entries never list in By Type or Summaries (RoleCall's rule); the tree lists every enabled entry.
 */
import { ENTRY_TYPE_INFO, type CompendiumEntry, type EntryType, type TreeNode } from "../../../../../core/compendium";
import { listable, matches } from "../compendium-core";

export type Row =
  | { key: string; kind: "head"; label: string; count: number; type: EntryType | null }
  | { key: string; kind: "entry"; entry: CompendiumEntry; depth: number; ordinal?: number }
  | { key: string; kind: "node"; node: TreeNode; depth: number; open: boolean };

/** RoleCall's section order: Cast, Places, Items, Powers, Orgs, Events, Plots, Threats, World, Creatures, Recaps. */
const SECTION_ORDER: readonly EntryType[] = ["character", "location", "item", "power", "organization", "event", "plot", "threat", "worldbuilding", "creature", "summary"];

export function byTypeRows(entries: readonly CompendiumEntry[], query: string): Row[] {
  const rows: Row[] = [];
  for (const type of SECTION_ORDER) {
    const list = entries.filter((e) => e.type === type && listable(e) && matches(e, query)).sort((a, b) => a.name.localeCompare(b.name));
    if (list.length === 0) continue;
    rows.push({ key: `h:${type}`, kind: "head", label: ENTRY_TYPE_INFO[type].section, count: list.length, type });
    for (const entry of list) rows.push({ key: entry.id, kind: "entry", entry, depth: 0 });
  }
  return rows;
}

const turnFrom = (e: CompendiumEntry): number => {
  const range = e.data["turn_range"];
  return typeof range === "object" && range !== null && typeof (range as { from?: unknown }).from === "number" ? (range as { from: number }).from : Infinity;
};

/** Recaps grouped by their plot, plots by name and "Unplotted" last, each plot's recaps in turn order. */
export function summaryRows(entries: readonly CompendiumEntry[], query: string): Row[] {
  const groups = new Map<string, CompendiumEntry[]>();
  for (const e of entries) {
    if (e.type !== "summary" || !listable(e) || !matches(e, query)) continue;
    const plot = typeof e.data["parent_plot"] === "string" && e.data["parent_plot"].trim() ? e.data["parent_plot"].trim() : "Unplotted";
    groups.set(plot, [...(groups.get(plot) ?? []), e]);
  }
  const rows: Row[] = [];
  const names = [...groups.keys()].sort((a, b) => (a === "Unplotted" ? 1 : b === "Unplotted" ? -1 : a.localeCompare(b)));
  for (const plot of names) {
    const list = [...groups.get(plot)!].sort((a, b) => turnFrom(a) - turnFrom(b) || a.order - b.order);
    rows.push({ key: `p:${plot}`, kind: "head", label: plot, count: list.length, type: "plot" });
    list.forEach((entry, i) => rows.push({ key: entry.id, kind: "entry", entry, depth: 0, ordinal: i + 1 }));
  }
  return rows;
}

/**
 * The tree, flattened to what is showing. With a query, every branch holding a match opens and the rest drop out, as RoleCall's
 * search "auto-expands matches"; otherwise `open` (node ids) decides.
 */
export function treeRows(root: TreeNode, byId: ReadonlyMap<string, CompendiumEntry>, open: ReadonlySet<string>, query: string): Row[] {
  const q = query.trim().toLowerCase();
  const rows: Row[] = [];
  const hit = (id: string): CompendiumEntry | undefined => { const e = byId.get(id); return e && matches(e, query) ? e : undefined; };
  /** Rows for a node, or null when a query leaves nothing of it. */
  const walk = (node: TreeNode, depth: number): Row[] | null => {
    const kids = node.children.map((c) => walk(c, depth + 1));
    const own = node.entryIds.map(hit).filter((e): e is CompendiumEntry => e !== undefined);
    const labelHit = q !== "" && node.label.toLowerCase().includes(q);
    const anything = kids.some((k) => k !== null) || own.length > 0 || labelHit;
    if (q !== "" && !anything) return null;
    const isOpen = q !== "" || open.has(node.id);
    const out: Row[] = [{ key: `n:${node.id}`, kind: "node", node, depth, open: isOpen }];
    if (isOpen) {
      for (const k of kids) if (k) out.push(...k);
      const shown = q !== "" && !labelHit ? own : node.entryIds.map((id) => byId.get(id)).filter((e): e is CompendiumEntry => e !== undefined);
      for (const entry of shown) out.push({ key: `e:${node.id}:${entry.id}`, kind: "entry", entry, depth: depth + 1 });
    }
    return out;
  };
  for (const child of root.children) rows.push(...(walk(child, 0) ?? []));
  return rows;
}
