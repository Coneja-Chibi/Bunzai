/**
 * Compendium Diagnostics (RoleCall `lib/lorebook/tv-diagnostics.ts`, Settings > Diagnostics > Run Diagnostics): health checks over the
 * books a scene reads, each a pass, a warning or a failure with a message and a few detail lines, grouped by category. Ported:
 * the books the Compendium uses, a tree per book (a built one that has fallen behind the book, or the derived one), total and empty
 * entries, near-duplicate entries (RoleCall's trigram rule: content alone at 0.85, or a similar title at 0.70 with content at 0.50,
 * the first 500 entries of a book), entries missing from a built tree, the Historian's interval, the recall token budget (RoleCall's "Retrieved lore token budget", warn under 512: here the
 * lore share of the model's window, the cap recall really has), and recaps with no plot. The narrator's tool calls
 * (RoleCall's "Mandatory tool calls" row, `tv-diagnostics.ts:314-320`, which only echoed `tv_mandatory_tool`): Bunzai never forces a tool call
 * (04b F13), so the row states the Narrator explore tool and Narrator Tool Access as they are, and warns when one is on without the other.
 * Not ported, because Bunzai has no setting they could check: the summary token budget (RoleCall stores it and never reads it). Pure: the page reads the books and hands them in.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { StoredLayout } from "../../stage/contracts/chat-tree-types";
import { DEFAULT_LORE_SHARE } from "../assembly/types";
import { loreShareTokens } from "../assembly/recall-place";
import { canWrite, type ResolvedCompendium } from "./defaults";
import type { CompendiumAccess } from "../../stage/contracts/chat-settings-types";
import { readBook } from "./read";
import { normalizeName } from "./relationships";
import { ADDED_NODE, layoutToTree } from "./tree-layout";
import type { TreeNode } from "./tree";

export type DiagnosticStatus = "pass" | "warn" | "fail";
export interface Diagnostic { category: "Configuration" | "Infrastructure" | "Entries" | "Summaries"; check: string; status: DiagnosticStatus; message: string; details?: string[] }
export interface DiagnosticBook { id: string; name: string; access: CompendiumAccess; entries: readonly LorebookEntry[]; layout: StoredLayout | null; revision: string }

const DUP_CAP = 500;
const CONTENT = 0.85;
const TITLE = 0.7;
const CONTENT_WITH_TITLE = 0.5;
const STALE_INTERVAL = 50;
/** RoleCall's "Retrieved lore token budget" floor (`tv-diagnostics.ts:298`). */
const LOW_RECALL_TOKENS = 512;

const trigrams = (s: string): Set<string> => {
  const t = s.toLowerCase().trim();
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
};

/** RoleCall's coefficient: shared trigrams over the larger set. */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}

function duplicatePairs(entries: readonly LorebookEntry[]): string[] {
  const sample = entries.filter((e) => e.enabled).slice(0, DUP_CAP);
  const pairs: { text: string; sim: number }[] = [];
  sample.forEach((a, i) => {
    let best: { b: LorebookEntry; sim: number } | null = null;
    for (const b of sample.slice(i + 1)) {
      const content = trigramSimilarity(a.content, b.content);
      const title = trigramSimilarity(a.title, b.title);
      if ((content >= CONTENT || (title >= TITLE && content >= CONTENT_WITH_TITLE)) && (!best || Math.max(content, title) > best.sim)) best = { b, sim: Math.max(content, title) };
    }
    if (best) pairs.push({ sim: best.sim, text: `"${a.title || `(untitled #${i + 1})`}" and "${best.b.title || "(untitled)"}" (${Math.round(best.sim * 100)}% similar)` });
  });
  return pairs.sort((x, y) => y.sim - x.sim).map((p) => p.text);
}

const walk = (n: TreeNode, f: (n: TreeNode) => void): void => { f(n); n.children.forEach((c) => walk(c, f)); };

/** `context` is the window a turn of this scene fits into (request.ts `turnWindow` and `presetWindow`): recall draws on a share of it, which is the budget the recall check reads. */
export function runDiagnostics(books: readonly DiagnosticBook[], settings: { historian: Pick<ResolvedCompendium["historian"], "interval" | "overlap"> } & Partial<Pick<ResolvedCompendium, "lookup">>, context: number, tools: { access: boolean; rounds: number } = { access: false, rounds: 8 }): Diagnostic[] {
  const out: Diagnostic[] = [];
  const used = books.filter((b) => b.access !== "off");
  if (used.length === 0) return [{ category: "Configuration", check: "Compendium books", status: "fail", message: "No book is enabled for the Compendium in this scene" }];
  const writers = used.filter((b) => canWrite(b.access));
  out.push({ category: "Configuration", check: "Compendium books", status: "pass", message: `${used.length} ${used.length === 1 ? "book" : "books"} enabled, ${writers.length} allowing writes` });
  if (writers.length === 0) out.push({ category: "Configuration", check: "Write access", status: "warn", message: "No book allows writes, so filing, the Historian and Ingest cannot run" });

  for (const b of used) {
    const read = readBook(b.entries);
    if (!b.layout) { out.push({ category: "Infrastructure", check: `Tree for ${b.name}`, status: "pass", message: "Derived from the book (no built tree)" }); continue; }
    const added: string[] = [];
    walk(layoutToTree(b.layout, read).root, (n) => { if (n.id === ADDED_NODE) added.push(...n.entryIds); });
    const behind = b.layout.rev !== b.revision;
    out.push({ category: "Infrastructure", check: `Tree for ${b.name}`, status: behind ? "warn" : "pass", message: behind ? "Built from an earlier version of the book (consider rebuilding)" : "Built from the current book" });
    if (added.length > 0) out.push({ category: "Entries", check: `Orphaned entries (${b.name})`, status: "warn", message: `${added.length} entries not in the built tree. Repair tree from entries to fix.` });
  }

  const all = used.flatMap((b) => b.entries);
  const enabled = all.filter((e) => e.enabled);
  if (all.length === 0) return [...out, { category: "Entries", check: "Total entries", status: "warn", message: "The books are empty. Add entries (or run an ingest) before diagnosing." }];
  out.push({ category: "Entries", check: "Total entries", status: "pass", message: `${enabled.length} enabled / ${all.length} total` });
  const empty = enabled.filter((e) => !e.content.trim());
  if (empty.length > 0) out.push({ category: "Entries", check: "Empty entries", status: "warn", message: `${empty.length} entries have no content`, details: empty.map((e) => e.title || "(untitled)") });

  const dups = used.flatMap((b) => duplicatePairs(b.entries));
  const checked = used.reduce((n, b) => n + Math.min(DUP_CAP, b.entries.filter((e) => e.enabled).length), 0);
  const coverage = checked < enabled.length ? ` (checked ${checked} of ${enabled.length} entries)` : ` (checked all ${enabled.length} entries)`;
  out.push(dups.length > 0
    ? { category: "Entries", check: "Near-duplicate entries", status: "warn", message: `${dups.length} potential duplicate ${dups.length === 1 ? "pair" : "pairs"} found${coverage}`, details: dups }
    : { category: "Entries", check: "Near-duplicate entries", status: "pass", message: `No duplicates detected${coverage}` });

  const { interval } = settings.historian;
  const row = (status: DiagnosticStatus, message: string): Diagnostic => ({ category: "Configuration", check: "Narrator tool calls", status, message });
  out.push(!settings.lookup ? row("pass", "Narrator explore tool is off, so the narrator is offered no Compendium tools")
    : !tools.access ? row("warn", "Narrator explore tool is on, but Narrator Tool Access is off, so the narrator receives no tools")
    : row("pass", `On. The narrator may look entries up while it writes, up to ${tools.rounds} rounds. It uses the tool at its discretion; a tool call is never forced.`));
  out.push({ category: "Configuration", check: "Historian interval", status: interval > STALE_INTERVAL ? "warn" : "pass", message: interval === 0 ? "Off" : `Every ${interval} of your turns${interval > STALE_INTERVAL ? " (consider lowering for better coverage)" : ""}` });

  const budget = loreShareTokens(context, DEFAULT_LORE_SHARE);
  const low = budget < LOW_RECALL_TOKENS;
  out.push({ category: "Configuration", check: "Recall token budget", status: low ? "warn" : "pass", message: `${budget.toLocaleString("en-US")} tokens (a quarter of the ${context.toLocaleString("en-US")} token window)${low ? ", which may be too low to hold useful entries" : ""}` });

  const entries = used.flatMap((b) => readBook(b.entries));
  const recaps = entries.filter((e) => e.type === "summary" && e.enabled && !e.retired);
  out.push({ category: "Summaries", check: "Recaps", status: "pass", message: `${recaps.length} ${recaps.length === 1 ? "recap" : "recaps"}` });
  const plots = new Set(entries.filter((e) => e.type === "plot" && e.enabled && !e.retired).map((e) => normalizeName(e.name)));
  const loose = recaps.filter((e) => !plots.has(normalizeName(String(e.data["parent_plot"] ?? ""))));
  if (loose.length > 0) out.push({ category: "Summaries", check: "Orphaned recaps", status: "warn", message: `${loose.length} recaps belong to no plot in the books`, details: loose.map((e) => e.name) });
  return out;
}
