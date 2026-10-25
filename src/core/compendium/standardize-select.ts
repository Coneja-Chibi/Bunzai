/**
 * Which entries a Standardize run converts and how it cuts them into batches (RoleCall `lib/compendium/standardize.ts:290-389`,
 * `BentoDashboard.tsx:235-292`). A classic entry waits when it has no type, is not retired (a retired one was consumed by an
 * earlier run) and is not under the person's Preserve lock; switched-off entries convert too, since converting is not retrieving.
 * Batches are cut by entry count, or by a token budget (RoleCall turns the budget into an average count; here the entries are
 * packed to the budget, one at least per batch). Pure.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { countText } from "../tokens";
import { readEntry, type CompendiumEntry } from "./read";

export const waitingFor = (e: CompendiumEntry): boolean => e.type === null && !e.retired && !e.preserved;

/** The book's entries a run would convert, in book order. */
export const classicSources = (entries: readonly LorebookEntry[]): LorebookEntry[] => entries.filter((e, i) => waitingFor(readEntry(e, i)));

export type BatchPlan = { by: "entries"; size: number } | { by: "tokens"; budget: number };

export const entryTokens = (e: LorebookEntry): number => countText(`${e.title}\n${e.content}`);

export function makeBatches(sources: readonly LorebookEntry[], plan: BatchPlan): LorebookEntry[][] {
  const out: LorebookEntry[][] = [];
  let used = 0;
  for (const entry of sources) {
    const last = out[out.length - 1];
    const cost = plan.by === "tokens" ? entryTokens(entry) : 1;
    const limit = plan.by === "tokens" ? plan.budget : plan.size;
    if (last && used + cost <= limit) { last.push(entry); used += cost; } else { out.push([entry]); used = cost; }
  }
  return out;
}
