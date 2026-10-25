/** Node-compatible wire types shared by the Stage search owner and UI transport. */
import { isRecord } from "../guards";
export const SEARCH_RESULT_CEILING = 20_000;
/** In-scene search rules (ChatStore rule 35): the store refuses a query outside them, so the page caps to them first. */
export const MIN_WORD = 2;
export const MAX_WORD = 200;
export const MAX_SEARCH_WORDS = 8;
export const MAX_SEARCH_HITS = 200;
/** The single bounded request projection used by desktop and portable transports. */
export function parseSearchRequest(raw: unknown): SearchRequest | null {
  if (!isRecord(raw)) return null;
  const value = raw;
  if (typeof value.query !== "string" || value.query.length > 512) return null;
  if (value.kinds !== undefined && (!Array.isArray(value.kinds) || value.kinds.length > 80 || value.kinds.some((kind) => typeof kind !== "string" || kind.length > 80))) return null;
  const offset = value.offset === undefined ? 0 : value.offset;
  const limit = value.limit === undefined ? 500 : value.limit;
  if (!Number.isSafeInteger(offset) || (offset as number) < 0 || !Number.isSafeInteger(limit) || (limit as number) < 1) return null;
  if (value.generation !== undefined && (!Number.isSafeInteger(value.generation) || (value.generation as number) < 0)) return null;
  let scope: SearchRequest["scope"];
  if (value.scope !== undefined) {
    if (!isRecord(value.scope)) return null;
    const candidate = value.scope;
    if (candidate.kind === "lorebook-shelf") scope = { kind: "lorebook-shelf" };
    else if (candidate.kind === "lorebook-entry" && typeof candidate.id === "string" && candidate.id.length <= 240 && (candidate.revision === undefined || (typeof candidate.revision === "string" && candidate.revision.length <= 256))) {
      scope = { kind: "lorebook-entry", id: candidate.id, ...(typeof candidate.revision === "string" ? { revision: candidate.revision } : {}) };
    } else return null;
  }
  return { query: value.query, ...(Array.isArray(value.kinds) ? { kinds: [...value.kinds] as string[] } : {}), ...(scope ? { scope } : {}), offset: Math.min(SEARCH_RESULT_CEILING, offset as number), limit: Math.min(500, limit as number), ...(typeof value.generation === "number" ? { generation: value.generation } : {}) };
}
export interface SearchRequest {
  query: string;
  kinds?: readonly string[];
  scope?: { kind: "lorebook-entry"; id: string; revision?: string } | { kind: "lorebook-shelf" };
  offset?: number;
  limit?: number;
  /** Fences subsequent pages to the first page's mutation generation. */
  generation?: number;
}

export interface SearchHit { kind: string; id: string; score: number; snippet: string; entryIndex?: number }
export interface SearchResponse { active: boolean; unknown: readonly string[]; total: number; /** Number of leading matches this generation can page through within its memory budget. */ available: number; hits: readonly SearchHit[]; generation?: number; truncated?: boolean; stale?: boolean }
