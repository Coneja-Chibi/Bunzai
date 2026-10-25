/**
 * The index recall's selector reads (04b D4, RoleCall `formatTreeOverview`, `lib/lorebook/tree-builder.ts:533+`): each readable
 * book's derived tree (tree.ts) to `depth` levels, every entry a line with a short handle the answer names. A handle is
 * stable for one index and means nothing outside it, so an id the model invents resolves to nothing instead of an entry.
 * Entries whose covered span is still in the live window are left out (RoleCall `compendium-freshness.ts`: the narrator is
 * not told what it just read). The index has a token budget; what does not fit is counted, never silently dropped.
 */
import type { LorebookCategory, LorebookEntry } from "../../entities/lorebook/schema";
import { isRecord } from "../guards";
import { countText } from "../tokens";
import { readBook, type CompendiumEntry } from "./read";
import { buildTree, type TreeNode } from "./tree";

export interface RecallBook { id: string; name: string; entries: readonly LorebookEntry[]; categories: readonly LorebookCategory[] }

/** Where the live conversation window starts: a summary or event whose span reaches it is still in front of the narrator. */
export interface LiveWindow { firstMessage: number; firstUserTurn: number }

export interface RecallIndexOptions {
  detail: "names" | "taglines" | "preview";
  /** Tree levels shown as headings; entries below it are listed under their depth-level group. */
  depth: number;
  bookDisplay: "unified" | "per_book";
  tokenBudget: number;
  live?: LiveWindow;
}

export interface RecallCandidate { handle: string; key: string; bookId: string; bookName: string; entryId: string; name: string; content: string }
export interface RecallIndex { text: string; candidates: ReadonlyMap<string, RecallCandidate>; omitted: number }

const PREVIEW_CHARS = 500;

/** RoleCall's `isStillLiveEntry` (`compendium-freshness.ts:31-60`) for the shapes a book can hold here. */
export function isStillLive(entry: LorebookEntry, live: LiveWindow): boolean {
  const meta = isRecord(entry.metadata) ? entry.metadata : {};
  const data = isRecord(meta["structured_data"]) ? meta["structured_data"] : {};
  const to = isRecord(data["turn_range"]) ? data["turn_range"]["to"] : undefined;
  if (meta["entry_type"] === "summary" && typeof to === "number" && to >= live.firstMessage) return true;
  const turn = meta["turnNumber"];
  return (meta["entry_type"] === "plot" || meta["entry_type"] === "event") && typeof turn === "number" && turn >= live.firstUserTurn;
}

const line = (e: CompendiumEntry, handle: string, raw: LorebookEntry, detail: RecallIndexOptions["detail"]): string => {
  const aka = e.aliases.length > 0 ? ` (aka ${e.aliases.join(", ")})` : "";
  const tag = detail !== "names" && e.tagline ? ` - ${e.tagline}` : "";
  const preview = detail === "preview" && raw.content.trim() ? ` | ${raw.content.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS)}` : "";
  return `[${handle}] ${e.name}${aka}${tag}${preview}`;
};

/** The groups to print: nodes down to `depth`, each with the entries listed on it and, at the last level, on everything below. */
function groups(node: TreeNode, level: number, depth: number, out: { label: string; level: number; count: number; ids: string[] }[]): void {
  const below = (n: TreeNode): string[] => [...n.entryIds, ...n.children.flatMap(below)];
  out.push({ label: node.label, level, count: node.entryCount, ids: level >= depth ? below(node) : node.entryIds });
  if (level < depth) for (const child of node.children) groups(child, level + 1, depth, out);
}

export function buildRecallIndex(books: readonly RecallBook[], options: RecallIndexOptions): RecallIndex {
  const candidates = new Map<string, RecallCandidate>();
  const lines: string[] = [];
  let used = 0;
  let omitted = 0;
  let full = false;
  const push = (text: string): boolean => {
    const cost = countText(text);
    if (full || used + cost > options.tokenBudget) return (full = true), false;
    used += cost;
    lines.push(text);
    return true;
  };
  const combined = options.bookDisplay === "unified" && books.length > 1;
  if (combined) push("World Knowledge (combined):");
  for (const book of books) {
    const all = readBook(book.entries);
    const live = options.live;
    const eligible = all.filter((e) => e.enabled && !e.retired && !(live && isStillLive(book.entries[e.order]!, live)));
    if (eligible.length === 0) continue;
    const tree = buildTree(eligible, book.categories);
    push(combined ? `Book: "${book.name}" (${eligible.length} entries)` : `=== Lorebook: "${book.name}" (${eligible.length} entries) ===`);
    const byId = new Map(eligible.map((e) => [e.id, e]));
    const listed: { label: string; level: number; count: number; ids: string[] }[] = [];
    for (const child of tree.root.children) groups(child, 1, Math.max(1, options.depth), listed);
    for (const g of listed) {
      const pad = "  ".repeat(g.level - 1 + (combined ? 1 : 0));
      if (!push(`${pad}${g.label} (${g.count})`)) { omitted += g.ids.length; continue; }
      for (const id of g.ids) {
        const e = byId.get(id)!;
        const handle = `e${candidates.size + 1}`;
        if (!push(`${pad}  ${line(e, handle, book.entries[e.order]!, options.detail)}`)) { omitted++; continue; }
        candidates.set(handle, { handle, key: `${book.id}:${e.id}`, bookId: book.id, bookName: book.name, entryId: e.id, name: e.name, content: book.entries[e.order]!.content });
      }
    }
  }
  if (omitted > 0) lines.push(`(+${omitted} more entries not shown)`);
  return { text: lines.join("\n"), candidates, omitted };
}
