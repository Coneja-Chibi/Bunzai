/** Bounded result retention and pagination shared by native and browser search workers. */
import { compareSearchHits, type ParsedQuery, type SearchablePiece } from "./query";
import { SEARCH_RESULT_CEILING, type SearchRequest, type SearchResponse } from "./contracts";

export type RankedWorkerHit = { piece: Pick<SearchablePiece, "id" | "kind" | "name">; score: number; snippet: string };
export function rankedQuery(query: ParsedQuery): boolean {
  return query.terms.some((term) => !term.negated && ["text", "name", "id"].includes(term.field));
}
export function retainWorkerHit(heap: RankedWorkerHit[], hit: RankedWorkerHit, capacity: number, ranked: boolean): void {
  if (!capacity) return;
  if (!ranked) { if (heap.length < capacity) heap.push(hit); return; }
  if (heap.length < capacity) {
    heap.push(hit);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareSearchHits(heap[index]!, heap[parent]!) <= 0) break;
      [heap[index], heap[parent]] = [heap[parent]!, heap[index]!];
      index = parent;
    }
  } else if (compareSearchHits(hit, heap[0]!) < 0) {
    heap[0] = hit;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1, right = left + 1;
      let worst = index;
      if (left < heap.length && compareSearchHits(heap[left]!, heap[worst]!) > 0) worst = left;
      if (right < heap.length && compareSearchHits(heap[right]!, heap[worst]!) > 0) worst = right;
      if (worst === index) break;
      [heap[index], heap[worst]] = [heap[worst]!, heap[index]!];
      index = worst;
    }
  }
}
export function workerPage(input: SearchRequest, total: number, hits: SearchResponse["hits"], active: boolean, unknown: readonly string[], available: number): SearchResponse {
  const offset = Math.min(SEARCH_RESULT_CEILING, Math.max(0, input.offset ?? 0));
  const limit = Math.min(500, Math.max(1, input.limit ?? 500));
  const reachable = Math.min(total, available);
  return { active, unknown, total, available: reachable, hits: hits.slice(offset, Math.min(reachable, offset + limit)), truncated: total > reachable };
}
export function orderedWorkerHits(hits: RankedWorkerHit[], ranked: boolean): SearchResponse["hits"] {
  return (ranked ? hits.sort(compareSearchHits) : hits).map(({ piece, score, snippet }) => ({ kind: piece.kind, id: piece.id, score, snippet }));
}
