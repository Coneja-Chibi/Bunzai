/** Structured-clone protocol for the long-lived, disposable in-memory search worker. */
import type { SearchRequest, SearchResponse } from "../../core/search/contracts";
import type { SearchablePiece } from "../../core/search/query";
import type { SearchShardEntry } from "../../core/search/shard";

export type SearchDocument = SearchablePiece & { provenance?: string; snippet: string };
export type SearchWorkerRequest =
  | { requestId: number; op: "upsert"; docs: SearchDocument[] }
  | { requestId: number; op: "remove"; kind: string; id: string }
  | { requestId: number; op: "membership"; kind: string; id: string; collections: string[] }
  | { requestId: number; op: "membership-reset" }
  | { requestId: number; op: "membership-batch"; memberships: { kind: string; id: string; collectionId: string }[] }
  | { requestId: number; op: "lore-start"; bookId: string; count: number }
  | { requestId: number; op: "lore-chunk"; bookId: string; offset: number; entries: SearchShardEntry[] }
  | { requestId: number; op: "lore-end"; bookId: string }
  | { requestId: number; op: "search"; input: SearchRequest; resultLimit: number; scratchLimit: number }
  | { requestId: number; op: "cancel"; targetId: number }
  | { requestId: number; op: "dispose" };
export type SearchWorkerReply = { requestId: number; ok: true; value: SearchResponse | { bytes: number; generation?: number } | null }
  | { requestId: number; ok: false; reason: string };
