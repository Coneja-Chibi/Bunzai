/** Bounded POST transport for the shared search owner, returning ids and snippets only. */
import type { SearchRequest, SearchResponse } from "./app-contract-search";
import { json, readJsonObject } from "./server-security";
import { parseSearchRequest } from "../core/search/contracts";

export interface SearchRouteService {
  search(input: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>;
}

export async function handleSearch(request: Request, service: SearchRouteService): Promise<Response> {
  const body = await readJsonObject(request, 64 * 1024);
  if (!body.ok) return body.response;
  const input = parseSearchRequest(body.value);
  if (!input) return json({ error: "invalid search request" }, 400);
  try {
    return json(await service.search(input, request.signal));
  } catch {
    return json({ error: "search is unavailable" }, 503);
  }
}
