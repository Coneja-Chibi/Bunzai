/**
 * The Compendium's tree, derived from the book and never stored (04b D3). A port of RoleCall's typed builder
 * (`lib/lorebook/tv-tree-typed.ts`): eleven buckets in fixed order, per-bucket sub-grouping, an Unsorted bucket for entries
 * without a type, and the typed path only when the book is mostly typed (`:121-147`). A book that is not falls back to its
 * own categories (`lib/lorebook/tree-builder.ts:56-111`). Pure: the same entries give the same tree.
 *
 * Not ported, on purpose: the pin pass (`tv-tree-typed.ts:735+`, Track D constraints), RoleCall's title-keyword clustering
 * of more than 15 uncategorized entries (replaced by one General node), and its `creature` flat fallback (dead code: a
 * creature without a classification already lands in Unclassified). RoleCall drops an entry whose category id is gone
 * from its book; here that entry goes to General.
 */
import type { LorebookCategory } from "../../entities/lorebook/schema";
import { recArray } from "../guards";
import type { CompendiumEntry } from "./read";
import { ENTRY_TYPES, ENTRY_TYPE_INFO, type EntryType } from "./types";

export interface TreeNode {
  id: string;
  label: string;
  summary: string;
  /** Entries listed directly on this node (a bucket with sub-groups lists none itself). */
  entryIds: string[];
  children: TreeNode[];
  /** This node's entries plus all below it. */
  entryCount: number;
  kind?: EntryType | "unsorted" | "arc" | "category" | "pinned";
}

export interface TreeStats { nodeCount: number; maxDepth: number; leafCount: number }
export interface CompendiumTree {
  typed: boolean;
  root: TreeNode;
  stats: TreeStats;
  /** True when this is a layout a model built and the scene stored, not the tree derived from the book (04b D3, Track D). */
  stored?: boolean;
}

/** RoleCall's detection (`tv-tree-typed.ts:121-147`): at least 5 enabled entries and at least half typed. */
export const TYPED_THRESHOLD = 0.5;
export const TYPED_MINIMUM = 5;

export function shouldUseTyped(entries: readonly CompendiumEntry[]): { use: boolean; typedCount: number; totalEnabled: number; ratio: number } {
  const enabled = entries.filter((e) => e.enabled);
  const typedCount = enabled.filter((e) => e.type !== null).length;
  const ratio = enabled.length === 0 ? 0 : typedCount / enabled.length;
  return { use: enabled.length >= TYPED_MINIMUM && ratio >= TYPED_THRESHOLD, typedCount, totalEnabled: enabled.length, ratio };
}

const summaryOf = (entries: readonly CompendiumEntry[]): string =>
  entries.length === 0 ? "Empty" : entries.length <= 3 ? entries.map((e) => e.title).join(", ") : `${entries.slice(0, 3).map((e) => e.title).join(", ")}, and ${entries.length - 3} more`;

const leaf = (id: string, label: string, entries: readonly CompendiumEntry[], kind?: TreeNode["kind"]): TreeNode =>
  ({ id, label, summary: summaryOf(entries), entryIds: entries.map((e) => e.id), children: [], entryCount: entries.length, ...(kind ? { kind } : {}) });

const bucket = (type: EntryType, entries: readonly CompendiumEntry[], children: TreeNode[], flat = false): TreeNode => {
  const label = ENTRY_TYPE_INFO[type].bucket;
  return { id: `bucket:${type}`, label, summary: `${entries.length} ${label.toLowerCase()} entries`, entryIds: flat ? entries.map((e) => e.id) : [], children, entryCount: entries.length, kind: type };
};

/** Groups by a trimmed key; entries with no key come back apart. Insertion order is kept, so ties sort the way the book reads. */
function groupBy(entries: readonly CompendiumEntry[], key: (e: CompendiumEntry) => unknown): { groups: [string, CompendiumEntry[]][]; none: CompendiumEntry[] } {
  const map = new Map<string, CompendiumEntry[]>();
  const none: CompendiumEntry[] = [];
  for (const e of entries) {
    const raw = key(e);
    const k = typeof raw === "string" ? raw.trim() : "";
    if (k === "") none.push(e);
    else map.set(k, [...(map.get(k) ?? []), e]);
  }
  return { groups: [...map], none };
}

const bySize = (a: [string, CompendiumEntry[]], b: [string, CompendiumEntry[]]) => b[1].length - a[1].length;
const titled = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const group = (type: EntryType, label: string, list: CompendiumEntry[], kind?: TreeNode["kind"]) => leaf(`${type}/${encodeURIComponent(label)}`, label, list, kind);

/** RoleCall groups characters by `affiliations[0].with` (`:212-235`). */
function castBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy(entries, (e) => recArray(e.data["affiliations"])[0]?.["with"]);
  const children = groups.sort(bySize).map(([name, list]) => group("character", name, list));
  if (none.length > 0) children.push(group("character", "Unaffiliated", none));
  return bucket("character", entries, children);
}

/** Places nest under `parent_location` by title (`:242-338`). A parent outside the book, or a cycle, still shows at the top. Two places with the same title share one slot, as in RoleCall. */
function placesBucket(entries: CompendiumEntry[]): TreeNode {
  const byName = new Map<string, CompendiumEntry>();
  for (const e of entries) byName.set(e.title.toLowerCase().trim(), e);
  const parentOf = (e: CompendiumEntry): string | null => {
    const p = e.data["parent_location"];
    return typeof p === "string" && p.trim() ? p.trim().toLowerCase() : null;
  };
  const kids = new Map<string, CompendiumEntry[]>();
  const top: CompendiumEntry[] = [];
  for (const e of entries) {
    const parent = parentOf(e);
    if (parent === null || !byName.has(parent)) top.push(e);
    else kids.set(parent, [...(kids.get(parent) ?? []), e]);
  }
  const seen = new Set<string>();
  // A place already on the way down is left out of its own subtree (RoleCall repeats it as a leaf and counts it twice).
  const build = (e: CompendiumEntry, path: Set<string>): TreeNode | null => {
    const key = e.title.toLowerCase().trim();
    seen.add(key);
    if (path.has(key)) return null;
    const id = `place:${e.id}`;
    path.add(key);
    const children = (kids.get(key) ?? []).flatMap((k) => build(k, path) ?? []);
    path.delete(key);
    const count = 1 + children.reduce((n, c) => n + c.entryCount, 0);
    return { id, label: e.title, summary: children.length ? `${e.title} (${count - 1} sub-locations)` : e.title, entryIds: [e.id], children, entryCount: count };
  };
  const children = top.flatMap((e) => build(e, new Set()) ?? []);
  for (const e of entries) {
    const node = seen.has(e.title.toLowerCase().trim()) ? null : build(e, new Set());
    if (node) children.push(node);
  }
  return bucket("location", entries, children.sort((a, b) => b.entryCount - a.entryCount));
}

/** RoleCall groups events by their first related plot (`:355-380`). */
function eventsBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy(entries, (e) => (Array.isArray(e.data["related_plots"]) ? e.data["related_plots"][0] : undefined));
  const children = groups.sort(bySize).map(([plot, list]) => group("event", plot, list));
  if (none.length > 0) children.push(group("event", "Standalone", none));
  return bucket("event", entries, children);
}

const SEVERITY_RANK: Record<string, number> = { extinction_level: 0, catastrophic: 1, major: 2, notable: 3, minor: 4 };
const SEVERITY_SYNONYM: Record<string, string> = { existential: "extinction_level", moderate: "notable", resolved: "minor" };
/** RoleCall's canonical severity (`:408-414`), shared with the dashboard's threat sort. */
export const canonicalSeverity = (sev: string): string => { const s = sev.toLowerCase().trim(); return SEVERITY_SYNONYM[s] ?? s; };
export const severityRank = (sev: unknown): number => (typeof sev === "string" ? SEVERITY_RANK[canonicalSeverity(sev)] ?? 99 : 99);

/** Threats group by severity, worst first, unknown last (`:416-447`). */
function threatsBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy(entries, (e) => (typeof e.data["severity"] === "string" ? canonicalSeverity(e.data["severity"]) : null));
  const children = groups.sort((a, b) => severityRank(a[0]) - severityRank(b[0])).map(([sev, list]) => group("threat", titled(sev), list));
  if (none.length > 0) children.push(group("threat", "Unrated", none));
  return bucket("threat", entries, children);
}

function worldBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy(entries, (e) => e.data["category"]);
  const children = groups.sort(bySize).map(([cat, list]) => group("worldbuilding", cat.replace(/\b\w/g, (c) => c.toUpperCase()), list));
  if (none.length > 0) children.push(group("worldbuilding", "General", none));
  return bucket("worldbuilding", entries, children);
}

/** Summaries group by `parent_plot`, plots in name order, as arcs (`:476-500`); a plot's arc overview sits first in its arc, as RoleCall puts it. */
export function narrativeBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy([...entries].sort((a, b) => Number(b.arc !== null) - Number(a.arc !== null)), (e) => e.arc ?? e.data["parent_plot"]);
  const children = groups.sort((a, b) => a[0].localeCompare(b[0])).map(([plot, list]) => group("summary", plot, list, "arc"));
  if (none.length > 0) children.push(group("summary", "Unlinked Summaries", none));
  return bucket("summary", entries, children);
}

function bestiaryBucket(entries: CompendiumEntry[]): TreeNode {
  const { groups, none } = groupBy(entries, (e) => e.data["classification"]);
  const children = groups.sort(bySize).map(([cls, list]) => group("creature", cls.replace(/\b\w/g, (c) => c.toUpperCase()), list));
  if (none.length > 0) children.push(group("creature", "Unclassified", none));
  return bucket("creature", entries, children);
}

const BUILDERS: Partial<Record<EntryType, (entries: CompendiumEntry[]) => TreeNode>> = {
  character: castBucket, location: placesBucket, event: eventsBucket, threat: threatsBucket, worldbuilding: worldBucket, summary: narrativeBucket, creature: bestiaryBucket,
};

export function treeStats(root: TreeNode): TreeStats {
  const stats = { nodeCount: 0, maxDepth: 0, leafCount: 0 };
  const walk = (node: TreeNode, depth: number): void => {
    stats.nodeCount += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    if (node.children.length === 0) stats.leafCount += 1;
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(root, 1);
  return stats;
}

const rootOf = (children: TreeNode[], total: number, what: string): TreeNode =>
  ({ id: "root", label: "World Knowledge", summary: `${total} entries across ${children.length} ${what}`, entryIds: [], children, entryCount: total });

function typedTree(enabled: CompendiumEntry[]): TreeNode {
  const children: TreeNode[] = [];
  for (const type of ENTRY_TYPES) {
    const list = enabled.filter((e) => e.type === type || (type === "summary" && e.arc !== null));
    if (list.length > 0) children.push(BUILDERS[type]?.(list) ?? bucket(type, list, [], true));
  }
  const unsorted = enabled.filter((e) => e.type === null && e.arc === null);
  if (unsorted.length > 0) children.push({ id: "bucket:unsorted", label: "Unsorted", summary: `${unsorted.length} entries without a compendium type`, entryIds: unsorted.map((e) => e.id), children: [], entryCount: unsorted.length, kind: "unsorted" });
  return rootOf(children, enabled.length, "compendium buckets");
}

function categoryTree(enabled: CompendiumEntry[], categories: readonly LorebookCategory[]): TreeNode {
  const known = new Set(categories.map((c) => c.id));
  const children: TreeNode[] = [];
  for (const c of [...categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = enabled.filter((e) => e.categoryId === c.id);
    if (list.length > 0) children.push(leaf(`category:${c.id}`, c.name, list, "category"));
  }
  const general = enabled.filter((e) => e.categoryId === null || !known.has(e.categoryId));
  if (general.length > 0) children.push(leaf("category:general", "General", general, "category"));
  return rootOf(children, enabled.length, "categories");
}

/** The tree of a book's enabled entries: typed buckets when the book is mostly typed, its own categories otherwise. */
export function buildTree(entries: readonly CompendiumEntry[], categories: readonly LorebookCategory[] = []): CompendiumTree {
  const enabled = entries.filter((e) => e.enabled);
  const typed = shouldUseTyped(entries).use;
  const root = typed ? typedTree(enabled) : categoryTree(enabled, categories);
  return { typed, root, stats: treeStats(root) };
}
