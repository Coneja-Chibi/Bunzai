/**
 * Recursive trigger matching: an entry's own content can trigger other entries. Ported from
 * RoleCall's matching/recursion.ts onto canonical fields - no per-entry
 * `allowRecursion` (dropped), so a book's own `globalRecursion` is the only recursion gate, and
 * `excludeRecursion` entries are never candidates here at all (engine.ts's own candidate filter
 * already excludes them before recursion.ts runs, so its "first pass only" carve-out for them is
 * dead code there; not carried over). Advanced-mode probability is additive here, unlike the
 * direct pass's "highest wins" - a RoleCall inconsistency between its two call sites, kept as
 * found (see scan.ts's docblock).
 */
import type { LoreScan } from "./types";
import { buildScanText, evaluateEntry, type ScanSources } from "./scan";
import { isDelayBlocked, isOnCooldown, type TimersIndex } from "./timers";
import { entryKey, vectorizedRecursionOk, type EntryRef } from "./types";

const MAX_RECURSION_DEPTH = 10;

export interface RecursionHit {
  ref: EntryRef;
  matchedKeywords: string[];
  probability: number;
  /** recursion depth it was found at (0 = first recursion pass), explain-only diagnostic */
  depth?: number;
}

/** `candidates` must already be filtered to enabled, character-filter-passed, not excludeRecursion,
 * the owning book's globalRecursion on, and not on cooldown - engine.ts's job, not this file's. */
export function evaluateWithRecursion(
  candidates: readonly EntryRef[],
  sources: ScanSources,
  scan: LoreScan,
  rng: () => number,
  timers: TimersIndex,
): RecursionHit[] {
  const triggered: RecursionHit[] = [];
  const triggeredIds = new Set<string>();
  const activeContents: string[] = [];

  let foundNew = true;
  for (let depth = 0; foundNew && depth < MAX_RECURSION_DEPTH; depth++) {
    foundNew = false;

    for (const ref of candidates) {
      const { entry, book } = ref;
      if (triggeredIds.has(entry.id)) continue;
      if (entry.delayUntilRecursion > depth) continue;

      const keywordOptions = {
        caseSensitive: entry.caseSensitive ?? book.body.globalCaseSensitive,
        matchWholeWords: entry.matchWholeWords ?? book.body.globalMatchWholeWords,
      };
      let scanText = buildScanText(entry, book.body, sources);
      if (activeContents.length > 0) scanText = `${scanText}\n${activeContents.join("\n")}`;

      const result = evaluateEntry(entry, scanText, keywordOptions, scan, rng, timers, "additive");
      if (!result.matched) continue;

      triggeredIds.add(entry.id);
      triggered.push({ ref, matchedKeywords: result.matchedKeywords, probability: result.probability, depth });
      if (!entry.preventRecursion && entry.content) activeContents.push(entry.content);
      foundNew = true;
    }
  }

  return triggered;
}

/** Whether recursion should even run: RoleCall gates it on any relevant book having
 * globalRecursion on (recursion.ts is a no-op otherwise - no reason to build candidates). */
export function anyBookWantsRecursion(entries: readonly EntryRef[]): boolean {
  return entries.some((ref) => ref.book.body.globalRecursion);
}

export function recursionCandidates(entries: readonly EntryRef[], timers: TimersIndex, messageCount: number): EntryRef[] {
  return entries.filter(
    (ref) =>
      !ref.entry.excludeRecursion &&
      ref.book.body.globalRecursion &&
      // bug 6: excluded from the pool means excluded on BOTH sides - it can neither be woken by
      // recursion here, nor (since it then never reaches evaluateWithRecursion's loop) seed
      // further recursion with its own content. Same combined effect wake.ts's two independent
      // vectorized checks (source and target) produce.
      vectorizedRecursionOk(ref.entry.vectorized, ref.book.body) &&
      !isOnCooldown(timers, entryKey(ref.book.id, ref.entry.id), ref.entry.sticky, ref.entry.cooldown) &&
      // the same message-count hold the direct pass applies, so a book's recursion cannot wake a delayed entry early
      !isDelayBlocked(ref.entry.delay, messageCount),
  );
}
