/** UI transport names for the shared runtime-neutral search request and result. */
import type { SearchRequest, SearchResponse } from "../core/search/contracts";
export type { SearchHit, SearchRequest, SearchResponse } from "../core/search/contracts";
export interface SearchApi {
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>;
}
