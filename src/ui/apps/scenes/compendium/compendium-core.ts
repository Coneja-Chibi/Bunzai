/**
 * The Compendium views' pure side: which book opens first, the one model a book's entries derive into (read once per
 * revision, 04b F20: RoleCall reads the book several times per open), the search both Browse lists share, and the small
 * display rules (initials, severity bar). No I/O, no React.
 */
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import type { ChatCompendiumTreeConstraints } from "../../../../stage/contracts/chat-store";
import type { StoredLayout } from "../../../../stage/contracts/chat-tree-types";
import type { LorebookCategory } from "../../../../entities/lorebook/schema";
import { ENTRY_TYPE_INFO, type EntryType, buildCrossRefs, classicSources, entryTokens, buildDashboard, buildRelationshipGraph, readBook, resolveTree, type CompendiumEntry, type CrossRefGraph, type Dashboard, type CompendiumTree, type RelationshipGraph } from "../../../../core/compendium";

export interface BookModel {
  name: string;
  entries: CompendiumEntry[];
  categories: LorebookCategory[];
  byId: Map<string, CompendiumEntry>;
  tree: CompendiumTree;
  dashboard: Dashboard;
  graph: CrossRefGraph;
  rels: RelationshipGraph;
  /** Classic entries a Standardize run would convert (no type, not retired, not under Preserve), and their tokens together. */
  waiting: number;
  waitingTokens: number;
}

/** One pass over the book: everything a tab shows is a field of this, so no tab walks the entries again. */
export function buildModel(body: LorebookBody): BookModel {
  const entries = readBook(body.entries);
  const categories = body.categories ?? [];
  const tree = resolveTree(entries, categories, null);
  const waiting = classicSources(body.entries);
  return {
    waiting: waiting.length, waitingTokens: waiting.reduce((n, e) => n + entryTokens(e), 0),
    name: body.name, entries, categories, byId: new Map(entries.map((e) => [e.id, e])), tree,
    dashboard: buildDashboard(entries, tree), graph: buildCrossRefs(entries), rels: buildRelationshipGraph(entries),
  };
}

/** The model with the tree the scene stored (or the derived one when none is) and the person's pins over it; everything else is shared, not recomputed. */
export function withTree(model: BookModel, layout: StoredLayout | null, constraints: ChatCompendiumTreeConstraints | undefined): BookModel {
  const pins = constraints?.pins;
  if (!layout && !pins) return model;
  const tree = resolveTree(model.entries, model.categories, layout, pins);
  return { ...model, tree, dashboard: buildDashboard(model.entries, tree) };
}

/** RoleCall opens the primary managed book, else the first (`resolveCompendiumBookId`); a scene has no primary, so the first book that is on and in the library. */
export const firstBookId = (books: readonly SceneLoreBook[]): string | null => books.find((b) => b.enabled && !b.missing)?.id ?? books.find((b) => !b.missing)?.id ?? null;

/** RoleCall's `filterLorebookEntries` for the codex search: name, title and aliases. Retired entries never list. */
export const listable = (e: CompendiumEntry): boolean => !e.retired;
export function matches(e: CompendiumEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q));
}

export const initialsOf = (name: string, max = 2): string => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, max).join("").toUpperCase();

/** The threat bar (`BentoDashboard.tsx:158-168`): five steps by severity, and the role the bar takes. */
export const SEVERITY_INDEX: Record<string, number> = { minor: 1, notable: 2, major: 3, catastrophic: 4, extinction_level: 5 };
export const severityStep = (canonical: string): number => SEVERITY_INDEX[canonical] ?? 0;
export const severityRole = (step: number): "danger" | "warn" | "mid" => (step >= 4 ? "danger" : step >= 3 ? "warn" : "mid");
export const titled = (s: string): string => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Glyphs RoleCall draws in text, written as escapes so no pictograph sits in the source (scan:emoji). */
export const GLYPH = { sep: "\u25B8", star: "\u2726", starOn: "\u2605", starOff: "\u2606", right: "\u2192", dot: "\u00B7", diamond: "\u25C6", check: "\u2713", cross: "\u2715", revert: "\u21BA" } as const;
/** A blank value, drawn as a hyphen (RoleCall draws an em dash; Bunzai copy has none). */
export const BLANK = "-";
export const typeRole = (type: string | null): string => (type ? `var(${ENTRY_TYPE_INFO[type as EntryType].token})` : "var(--stage-mute)");
