/** Keeps remote search results tied to the exact query and visible library snapshot. */
import { useEffect, useState } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import type { SearchHit } from "../../../core/search/contracts";
import { searchAllPages } from "./search-runner";

interface SearchResult {
  query: string;
  entities: StudioEntitySummary[];
  memberships: ReadonlyMap<string, string[]>;
  hits: SearchHit[];
  total: number;
  available: number;
  truncated: boolean;
  unavailable: boolean;
}

export function useSearchResults(
  search: Parameters<typeof searchAllPages>[0], query: string, active: boolean,
  entities: StudioEntitySummary[], memberships: ReadonlyMap<string, string[]>, retry: number,
): SearchResult & { current: boolean } {
  const [result, setResult] = useState<SearchResult>({ query: "", entities: [], memberships: new Map(), hits: [], total: 0, available: 0, truncated: false, unavailable: false });
  useEffect(() => {
    const controller = new AbortController();
    const update = (hits: SearchHit[], total = 0, available = 0, truncated = false, unavailable = false): void => {
      if (!controller.signal.aborted) setResult({ query, entities, memberships, hits, total, available, truncated, unavailable });
    };
    if (!active) update([]);
    else void searchAllPages(search, { query }, controller.signal).then(
      (page) => update(page.hits, page.total, page.available, page.truncated),
      () => update([], 0, 0, false, true),
    );
    return () => controller.abort();
  }, [search, query, active, entities, memberships, retry]);
  return { ...result, current: result.query === query && result.entities === entities && result.memberships === memberships };
}
