/** Reads bounded search pages for the existing all-deck Library presentation. */
import type { SearchApi } from "../../app-contract-search";
import { SEARCH_RESULT_CEILING, type SearchHit, type SearchRequest } from "../../../core/search/contracts";

export class SearchChangedError extends Error { }

export async function searchAllPages(
  search: SearchApi["search"],
  request: SearchRequest,
  signal: AbortSignal,
): Promise<{ hits: SearchHit[]; total: number; available: number; active: boolean; unknown: string[]; truncated: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const hits: SearchHit[] = [];
    let first = await search({ ...request, offset: 0, limit: 500 }, signal);
    if (first.stale || first.generation === undefined) { if (attempt === 0 && !signal.aborted) continue; throw new SearchChangedError("search index changed while opening results"); }
    const generation = first.generation;
    const total = first.total;
    const ceiling = Math.min(first.available, first.total, SEARCH_RESULT_CEILING);
    hits.push(...first.hits);
    let changed = false;
    for (let offset = 500; offset < ceiling; offset += 500) {
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      first = await search({ ...request, offset, limit: 500, generation }, signal);
      if (first.stale || first.generation !== generation || first.total !== total || first.available !== ceiling) { changed = true; break; }
      hits.push(...first.hits);
    }
    if (changed) { if (attempt === 0 && !signal.aborted) continue; throw new SearchChangedError("search index changed while paging results"); }
    if (hits.length >= ceiling) return { hits, total, available: ceiling, active: first.active, unknown: [...first.unknown], truncated: total > ceiling };
    if (attempt === 1 || signal.aborted) throw new SearchChangedError("search results changed; retry the search");
  }
  throw new SearchChangedError("search results changed; retry the search");
}
