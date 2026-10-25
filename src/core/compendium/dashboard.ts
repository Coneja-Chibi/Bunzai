/**
 * The Dashboard's numbers, derived once from a book (04b D3, F20: RoleCall reads the book several times per open). A port of
 * RoleCall's aggregate (`app/api/content/lorebooks/[id]/compendium/route.ts:39-197`): counts per type, the featured entry per
 * type (a starred one, else the newest), active plots, active threats, recaps by plot. Pure.
 *
 * Deviations, named: a lorebook entry has no updated-at, so "newest" is the highest `touched` time when the caller has one
 * (the receipts, F15) and the later position in the book otherwise; a retired entry counts nowhere; threats sort by the
 * canonical severity, so RoleCall's legacy words (existential, moderate) rank where they belong instead of at zero.
 */
import { isRecord, strArray } from "../guards";
import type { CompendiumEntry } from "./read";
import { severityRank, treeStats, type CompendiumTree } from "./tree";
import { ENTRY_TYPES, type EntryType } from "./types";

/** The types the Dashboard features one of (`route.ts:25`). */
export const FEATURED_TYPES = ["character", "location", "item", "power", "organization", "event", "creature"] as const;
const ACTIVE_PLOT = new Set(["not_started", "active", "stalled", "escalating"]);
const RESOLVED_THREAT = new Set(["averted", "realized"]);
const LIST_LIMIT = 8;
const RECAP_PLOTS = 4;
const RECAPS_PER_PLOT = 4;

export interface RecapGroup { plot: string; total: number; summaries: CompendiumEntry[] }

export interface Dashboard {
  counts: Record<EntryType, number>;
  /** Typed entries (retired left out). */
  total: number;
  /** Entries with no type yet, the Standardize banner's count (`route.ts:46-60`). */
  classic: number;
  featured: Partial<Record<(typeof FEATURED_TYPES)[number], CompendiumEntry>>;
  activePlots: CompendiumEntry[];
  activeThreats: CompendiumEntry[];
  worldConcepts: CompendiumEntry[];
  recaps: RecapGroup[];
  tree: ReturnType<typeof treeStats>;
}

const statusOf = (e: CompendiumEntry): string => (typeof e.data["status"] === "string" && e.data["status"] !== "" ? e.data["status"] : "active");

/** Position in a turn range, for ordering a plot's recaps (RoleCall `computed.ts` `summaryOrderWithinPlot`). */
const turnFrom = (e: CompendiumEntry): number | undefined => {
  const range = e.data["turn_range"];
  return isRecord(range) && typeof range["from"] === "number" ? range["from"] : undefined;
};

export function buildDashboard(entries: readonly CompendiumEntry[], tree: CompendiumTree, touched: ReadonlyMap<string, number> = new Map()): Dashboard {
  const live = entries.filter((e) => !e.retired);
  const typed = live.filter((e) => e.type !== null);
  const recency = (e: CompendiumEntry) => touched.get(e.id) ?? -1;
  const newest = (a: CompendiumEntry, b: CompendiumEntry) => recency(b) - recency(a) || b.order - a.order;
  const of = (type: EntryType) => typed.filter((e) => e.type === type);

  const counts = Object.fromEntries(ENTRY_TYPES.map((t) => [t, of(t).length])) as Record<EntryType, number>;
  const featured: Dashboard["featured"] = {};
  for (const type of FEATURED_TYPES) {
    const list = of(type);
    const pick = list.find((e) => e.featured) ?? [...list].sort(newest)[0];
    if (pick) featured[type] = pick;
  }

  const plots = new Map<string, CompendiumEntry[]>();
  for (const s of of("summary")) {
    const plot = typeof s.data["parent_plot"] === "string" && s.data["parent_plot"].trim() ? s.data["parent_plot"].trim() : "Unplotted";
    plots.set(plot, [...(plots.get(plot) ?? []), s]);
  }
  const order = (a: CompendiumEntry, b: CompendiumEntry) => (turnFrom(a) ?? Infinity) - (turnFrom(b) ?? Infinity) || a.order - b.order;
  const recaps = [...plots].sort(([a], [b]) => (a === "Unplotted" ? 1 : b === "Unplotted" ? -1 : a.localeCompare(b)))
    .slice(0, RECAP_PLOTS).map(([plot, list]) => ({ plot, total: list.length, summaries: [...list].sort(order).slice(0, RECAPS_PER_PLOT) }));

  return {
    counts, total: typed.length, classic: live.length - typed.length, featured,
    activePlots: of("plot").filter((e) => ACTIVE_PLOT.has(statusOf(e))).sort(newest).slice(0, LIST_LIMIT),
    activeThreats: of("threat").filter((e) => !RESOLVED_THREAT.has(statusOf(e)))
      .sort((a, b) => severityRank(a.data["severity"]) - severityRank(b.data["severity"]) || newest(a, b)).slice(0, LIST_LIMIT),
    worldConcepts: of("worldbuilding"), recaps, tree: tree.stats,
  };
}

/** A character's arc for the Featured Cast dots (`BentoDashboard.tsx:494-501`): the key moments, which one is current, and its label. */
export function arcOf(entry: CompendiumEntry): { moments: string[]; current: number; label: string } {
  const arc = isRecord(entry.data["arc"]) ? entry.data["arc"] : {};
  const moments = strArray(arc["key_moments"]);
  const current = typeof arc["current_phase_index"] === "number" ? arc["current_phase_index"] : Math.max(0, moments.length - 1);
  return { moments, current, label: moments[current] ?? (typeof arc["current_phase"] === "string" ? arc["current_phase"] : "") };
}
