/**
 * Thin authoring-aid key match preview. Not host-accurate activation.
 */
import { matchKeywordTrigger, resolveKeywordOptions, type KeywordMatchOptions } from "./engine/triggers-keyword";
import type { LorebookBody, LorebookEntry, Trigger } from "../../entities/lorebook/schema";
import { selectiveLogicMatches } from "./engine/scan";

export interface SampleMatchHit {
  entryId: string;
  title: string;
  matched: "primary" | "secondary" | "constant" | "none";
}

/** How many of `triggers` hit `text` - routed through matchKeywordTrigger (the same ReDoS-vetted,
 *  cached compile every real activation path uses), never a raw `new RegExp` on authored text. */
function matchCount(
  text: string,
  textLower: string,
  triggers: readonly Trigger[],
  options: KeywordMatchOptions,
): number {
  let n = 0;
  for (const t of triggers) if (matchKeywordTrigger(t, text, options, textLower)) n++;
  return n;
}

/**
 * For each entry, report whether sample text would match at a simple documented level.
 * Constant entries always match. Selective logic honors and_all/not_all exactly (B1).
 */
export function sampleMatchEntries(sampleText: string, book: LorebookBody): SampleMatchHit[] {
  const text = sampleText ?? "";
  const textLower = text.toLowerCase();
  return book.entries.map((e: LorebookEntry) => {
    if (e.constant) {
      return { entryId: e.id, title: e.title, matched: "constant" as const };
    }
    if (!e.enabled) {
      return { entryId: e.id, title: e.title, matched: "none" as const };
    }
    const options = resolveKeywordOptions(e, book);
    const primaryMatched = matchCount(text, textLower, e.triggers, options);
    if (e.secondaryTriggers.length === 0) {
      if (primaryMatched === 0) return { entryId: e.id, title: e.title, matched: "none" as const };
      return { entryId: e.id, title: e.title, matched: "primary" as const };
    }
    const secondaryMatched = matchCount(text, textLower, e.secondaryTriggers, options);
    const ok = selectiveLogicMatches(primaryMatched, secondaryMatched, e.secondaryTriggers.length, e.selectiveLogic);
    if (!ok) return { entryId: e.id, title: e.title, matched: "none" as const };
    if (primaryMatched > 0) return { entryId: e.id, title: e.title, matched: "primary" as const };
    return { entryId: e.id, title: e.title, matched: "secondary" as const };
  });
}
