/**
 * Recursion wake graph: which entries can wake which via
 * recursion, computed with the engine's own keyword matcher. Ported from the rule
 * src/core/lore/activation.ts's bookWakeGraph used (deleted in step 3 of the same port): A "can
 * wake" B when A is enabled, not preventRecursion, and (not vectorized, or the book's
 * vectorizedRecursion allows it), and has triggers or is constant; B is enabled, not
 * excludeRecursion, not constant, has triggers, passes the same vectorized check, and one of B's
 * own triggers matches A's content.
 *
 * The vectorized check is `vectorizedRecursionOk`, the exact
 * predicate `recursion.ts`'s `recursionCandidates` uses, so this map and the runtime engine can
 * never disagree about whether a vectorized entry takes part in recursion.
 */
import { matchKeywordTrigger, resolveKeywordOptions } from "./triggers-keyword";
import { vectorizedRecursionOk, type LoreBookInput } from "./types";

export function loreWakeGraph(book: LoreBookInput): { from: string; to: string; keyword: string }[] {
  const entries = book.body.entries;
  const edges: { from: string; to: string; keyword: string }[] = [];

  for (const a of entries) {
    if (!a.enabled || a.preventRecursion || !vectorizedRecursionOk(a.vectorized, book.body)) continue;
    if (a.triggers.length === 0 && !a.constant) continue;

    for (const b of entries) {
      if (a.id === b.id) continue;
      if (!b.enabled || b.excludeRecursion || !vectorizedRecursionOk(b.vectorized, book.body) || b.constant) continue;
      if (b.triggers.length === 0) continue;

      const opts = resolveKeywordOptions(b, book.body);
      for (const t of b.triggers) {
        if (matchKeywordTrigger(t, a.content, opts)) {
          edges.push({ from: a.id, to: b.id, keyword: t.keyword });
          break;
        }
      }
    }
  }

  return edges;
}
