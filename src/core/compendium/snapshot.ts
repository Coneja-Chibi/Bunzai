/**
 * What a filing pass shows the model of the books it may write (RoleCall `lib/compendium/compendium-prompts.ts:306-429`): every
 * live typed entry as its canonical name, the aliases it already answers to, its tagline and how long it already is, so the
 * model files under the existing name instead of a variant (the single most common source of RoleCall duplicates) and adds to a
 * long entry instead of rewriting it (F23, VVS-742). Also the identity match a filed item is resolved with. Pure.
 */
import { countText } from "../tokens";
import { normalizeName } from "./relationships";
import type { CompendiumEntry } from "./read";
import { ENTRY_TYPE_INFO, ENTRY_TYPES, type EntryType } from "./types";

/** RoleCall's budget for the snapshot (`:306`). */
export const SNAPSHOT_TOKENS = 30_000;

export interface SnapshotBook { id: string; name: string; entries: readonly CompendiumEntry[] }

export type Match =
  | { kind: "match"; entry: CompendiumEntry }
  /** The name belongs to an entry that has no type: filing never rewrites prose it did not write. */
  | { kind: "classic"; entry: CompendiumEntry }
  | { kind: "none" };

/** Every name an entry answers to, normalized: its name, its title and its aliases. */
export const entryNames = (e: CompendiumEntry): string[] => [e.name, e.title, ...e.aliases].map(normalizeName).filter(Boolean);

/** The entry a filed name means: a live entry of the same type by name, title or alias; else an untyped entry of that name; else none. */
export function findMatch(entries: readonly CompendiumEntry[], type: EntryType, name: string, aliases: readonly string[] = []): Match {
  const wanted = new Set([name, ...aliases].map(normalizeName).filter(Boolean));
  const hits = (e: CompendiumEntry) => entryNames(e).some((n) => wanted.has(n));
  const live = entries.filter((e) => !e.retired && e.enabled);
  const typed = live.find((e) => e.type === type && hits(e));
  if (typed) return { kind: "match", entry: typed };
  const classic = live.find((e) => e.type === null && hits(e));
  return classic ? { kind: "classic", entry: classic } : { kind: "none" };
}

const RESOLVED_PLOT = new Set(["resolved", "failed", "abandoned"]);

function line(e: CompendiumEntry): string {
  const aka = e.aliases.length > 0 ? ` (aka: ${e.aliases.join(", ")})` : "";
  const tagline = e.tagline ? ` - ${e.tagline}` : "";
  return `${e.name}${aka}${tagline} [${JSON.stringify(e.data).length} chars - add to it, do not rewrite]`;
}

/** The snapshot of the writable books, by book then type; resolved plots and retired entries are left out, and what does not fit the budget is counted, not cut mid-line. */
export function buildSnapshot(books: readonly SnapshotBook[], budget = SNAPSHOT_TOKENS): string {
  const out: string[] = [];
  let used = 0;
  let hidden = 0;
  for (const book of books) {
    const live = book.entries.filter((e) => e.type !== null && !e.retired && e.enabled && !(e.type === "plot" && RESOLVED_PLOT.has(String(e.data["status"] ?? ""))));
    if (live.length === 0) continue;
    out.push(`### ${book.name} [${book.id}]`);
    for (const type of ENTRY_TYPES) {
      const lines: string[] = [];
      for (const e of live.filter((x) => x.type === type)) {
        const text = `- ${line(e)}`;
        const cost = countText(text);
        if (used + cost > budget) hidden += 1;
        else { lines.push(text); used += cost; }
      }
      if (lines.length > 0) out.push(`${ENTRY_TYPE_INFO[type].label}:`, ...lines);
    }
  }
  if (hidden > 0) out.push(`(+${hidden} more entries not shown)`);
  return out.join("\n");
}
