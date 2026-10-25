/**
 * F3: debounce the Library's expensive derivation (parse the query, then walk
 * every piece in the studio) 150 ms behind the search box's own text, which stays instant - the same
 * 150 ms shape already used by the lore entry rail and the regex bench (workbench/lore/entry-rail.ts,
 * workbench/regex/bench-pane.tsx). A later keystroke's timer always replaces an earlier one's before
 * it fires (the effect's own cleanup below), so a fast typist never sees a stale filter land after a
 * fresher one. Clearing back to "" applies at once: a search someone just cleared must not keep
 * showing "no match" for another 150 ms.
 */
import { useDebouncedValue } from "../../_shared/use-debounced-value";

const DEBOUNCE_MS = 150;
const clearImmediately = (query: string): boolean => query === "";

export function useDebouncedQuery(query: string): string {
  const debounced = useDebouncedValue(query, DEBOUNCE_MS, clearImmediately);
  return query === "" ? "" : debounced;
}
