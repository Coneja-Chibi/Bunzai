/** Disposable browser search worker using the same grammar, ranking and bounded wire protocol. */
import { parseSearchRequest, SEARCH_RESULT_CEILING, type SearchResponse } from "../core/search/contracts";
import { parseQuery, queryUsesLoreKeys, scorePiece } from "../core/search/query";
import { matchingLoreShelfBooks, matchingLoreEntryIndexesRange } from "../core/search/lore-matching";
import { orderedWorkerHits, rankedQuery, retainWorkerHit, workerPage, type RankedWorkerHit } from "../core/search/worker-results";
import { searchMessageBytes, SEARCH_MESSAGE_BYTES } from "../core/search/worker-admission";
import type { SearchWorkerReply, SearchWorkerRequest } from "../stage/search/search-protocol";
import { PocketSearchIndex, SEARCH_BYTES } from "./search-index";
import { toErrorMessage } from "../error-message";

declare const self: Worker & { close(): void };
const pendingSearches = new Set<number>();
const cancelled = new Set<number>();
let tail: Promise<void> = Promise.resolve();
let queuedBytes = 0, queuedCount = 0;
const index = new PocketSearchIndex(() => queuedBytes);
const yieldWorker = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const reply = (value: SearchWorkerReply): void => self.postMessage(value);

async function search(message: Extract<SearchWorkerRequest, { op: "search" }>): Promise<SearchResponse | null> {
  const input = parseSearchRequest(message.input);
  if (!input || !Number.isSafeInteger(message.resultLimit) || message.resultLimit < 0 || message.resultLimit > SEARCH_RESULT_CEILING || !Number.isSafeInteger(message.scratchLimit) || message.scratchLimit < 0 || message.scratchLimit > SEARCH_BYTES) throw new Error("invalid search request");
  const parsed = parseQuery(input.query), available = message.resultLimit;
  const resultBytes = available * 768 + 256 * 1024;
  if (resultBytes > message.scratchLimit || index.bytes + queuedBytes + resultBytes > SEARCH_BYTES) throw new Error("search results exceed their memory budget");
  const hits: SearchResponse["hits"][number][] = [];
  let total = 0, scanned = 0;
  const interrupted = (): boolean => cancelled.has(message.requestId);
  const keysFor = (id: string): string[] => {
    const entries = index.lore.get(id)?.value ?? [];
    let bytes = 0;
    for (const entry of entries) for (const key of entry.keys) bytes += 32 + key.length * 12;
    if (bytes + resultBytes > message.scratchLimit || index.bytes + queuedBytes + bytes + resultBytes > SEARCH_BYTES) throw new Error("lore search scratch exceeds its memory budget");
    return entries.flatMap((entry) => entry.keys);
  };
  if (input.scope?.kind === "lorebook-entry") {
    const entries = index.lore.get(input.scope.id)?.value ?? [];
    for (let offset = 0; offset < entries.length; offset += 128) {
      if (interrupted()) return null;
      for (const entryIndex of matchingLoreEntryIndexesRange(input.query, entries, offset, offset + 128)) {
        total++;
        if (hits.length < available) { const entry = entries[entryIndex]!; hits.push({ kind: "lorebook-entry", id: entry.id, entryIndex, score: 0, snippet: entry.title.slice(0, 180) }); }
      }
      await yieldWorker();
    }
    return workerPage(input, total, hits, parsed.active, parsed.unknown, available);
  }
  const ranked = rankedQuery(parsed), heap: RankedWorkerHit[] = [];
  const kinds = input.kinds ? new Set(input.kinds) : null;
  for (const stored of index.documents.values()) {
    if (interrupted()) return null;
    if (++scanned % 128 === 0) await yieldWorker();
    const doc = stored.value;
    if (input.scope?.kind === "lorebook-shelf") {
      if (doc.kind !== "lorebook") continue;
      if (!matchingLoreShelfBooks(input.query, [{ ...doc, searchKeys: keysFor(doc.id) }]).length) continue;
      total++;
      if (hits.length < available) hits.push({ kind: doc.kind, id: doc.id, score: 0, snippet: doc.name.slice(0, 180) });
    } else {
      if (kinds && !kinds.has(doc.kind)) continue;
      const enriched = { ...doc, collections: index.collections(doc.kind, doc.id), searchKeys: doc.kind === "lorebook" && queryUsesLoreKeys(parsed) ? keysFor(doc.id) : undefined };
      const score = scorePiece(enriched, parsed.terms);
      if (score === null) continue;
      total++;
      retainWorkerHit(heap, { piece: { kind: doc.kind, id: doc.id, name: doc.name }, score, snippet: doc.snippet }, available, ranked);
    }
  }
  return workerPage(input, total, input.scope?.kind === "lorebook-shelf" ? hits : orderedWorkerHits(heap, ranked), parsed.active, parsed.unknown, available);
}

self.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data;
  if (!message || !Number.isSafeInteger(message.requestId) || message.requestId < 1) return;
  if (message.op === "dispose") { self.close(); return; }
  if (message.op === "cancel") {
    if (pendingSearches.has(message.targetId)) cancelled.add(message.targetId);
    reply({ requestId: message.requestId, ok: true, value: null }); return;
  }
  const bytes = searchMessageBytes(message);
  if (bytes > SEARCH_MESSAGE_BYTES || queuedCount >= 32 || queuedBytes + bytes > 4 * 1024 * 1024 || index.bytes + queuedBytes + bytes > SEARCH_BYTES) {
    reply({ requestId: message.requestId, ok: false, reason: "search worker queue exceeds its admission budget" }); return;
  }
  queuedBytes += bytes; queuedCount++;
  if (message.op === "search") pendingSearches.add(message.requestId);
  tail = tail.then(async () => {
    try {
      if (message.op === "search") reply({ requestId: message.requestId, ok: true, value: await search(message) });
      else { index.mutate(message); reply({ requestId: message.requestId, ok: true, value: { bytes: index.bytes } }); }
    } catch (error) {
      reply({ requestId: message.requestId, ok: false, reason: toErrorMessage(error, "search worker failed") });
    } finally {
      queuedBytes -= bytes; queuedCount--;
      pendingSearches.delete(message.requestId); cancelled.delete(message.requestId);
    }
  });
};
