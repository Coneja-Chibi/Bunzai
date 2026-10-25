/** One injected, lazy Stage owner for indexed search and its per-lock plaintext budget. */
import type { CollectionsFile } from "../../studio/collections-shape";
import type { EntitySummary } from "../../studio/store";
import type { StudioStoreLike } from "../../studio/contracts";
import type { StoredBody } from "../contracts/content-store";
import type { SearchRequest, SearchResponse } from "../../core/search/contracts";
import { parseQuery, queryUsesLoreKeys } from "../../core/search/query";
import { searchShard, searchShardBytes, type SearchShard } from "../../core/search/shard";
import { sourceLabelFor } from "../../core/search/source-label";
import { createStoredLoreInput } from "../../core/lore/engine/stored-input";
import type { LorebookBody } from "../../entities/lorebook/schema";
import type { LoreBookInput } from "../../core/lore/engine/types";
import { derivedFamilyBytes } from "../../core/derive/derive";
import { assertSearchString as assertString, projectSearchRequest, projectSearchSummary } from "./search-admission";
import { SearchWorkerClient } from "./search-worker-client";
import type { SearchDocument } from "./search-protocol";

const BUDGET = 64 * 1024 * 1024;
const BATCH = 64;
const LORE_BATCH = 128;
const MAX_PIECES = 100_000;
const MAX_PENDING_BYTES = 4 * 1024 * 1024;
const MAX_QUEUED_OPERATIONS = 256;
const MAX_QUEUED_BYTES = 4 * 1024 * 1024;
const IDLE_MS = 10 * 60 * 1000;
const SHARD_FAMILY = "search.shard@primary-title-v2";

export interface SearchService {
  search(input: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>;
  upsert(summary: EntitySummary): Promise<void>;
  remove(kind: string, id: string): Promise<void>;
  setMemberships(kind: string, id: string, collectionIds: readonly string[]): Promise<void>;
  invalidate(): void;
  dispose(): void;
}

export interface SearchServiceOptions {
  store: StudioStoreLike;
  readCollections: () => Promise<CollectionsFile>;
  sourceLabels: () => Promise<ReadonlyMap<string, string>>;
  createWorker?: () => SearchWorkerClient;
}

function documentFor(entity: EntitySummary, labels: ReadonlyMap<string, string>): SearchDocument {
  const name = assertString(entity.name);
  const tags = entity.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 128) throw new TypeError("search tag count exceeds its admission limit");
  for (const tag of tags) assertString(tag, 256);
  return {
    kind: assertString(entity.kind, 80), id: assertString(entity.id, 240), name,
    sourceFormat: entity.sourceFormat ? assertString(entity.sourceFormat, 120) : undefined,
    sourceVariant: entity.sourceVariant ? assertString(entity.sourceVariant, 120) : undefined,
    sourceLabel: assertString(sourceLabelFor(labels, entity) ?? "", 256) || undefined,
    provenance: (entity as EntitySummary & { provenance?: string }).provenance ? assertString((entity as EntitySummary & { provenance?: string }).provenance, 512) : undefined,
    hasPortrait: entity.hasPortrait, tags: [...tags], snippet: name.slice(0, 180),
  };
}

function estimateDocument(doc: SearchDocument): number {
  return 96 + (doc.id.length + doc.kind.length + doc.name.length + (doc.sourceLabel?.length ?? 0)
    + (doc.sourceFormat?.length ?? 0) + (doc.sourceVariant?.length ?? 0) + (doc.provenance?.length ?? 0)
    + (doc.tags ?? []).reduce((total, tag) => total + tag.length, 0)) * 3;
}
function estimateMessageDocument(doc: SearchDocument): number { return 128 + (estimateDocument(doc) - 96) * 2; }

export function createSearchService(options: SearchServiceOptions): SearchService {
  let worker: SearchWorkerClient | null = null;
  let indexed = false;
  let initializing: { epoch: number; promise: Promise<void> } | null = null;
  let idle: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let epoch = 0;
  let generation = 0;
  let mutationVersion = 0;
  let operationTail: Promise<void> = Promise.resolve();
  let queuedOperations = 0;
  let queuedBytes = 0;
  interface QueueTicket { owner: number; bytes: number; started: boolean; released: boolean; cancelled: boolean; run?: () => Promise<unknown>; signal?: AbortSignal; abort?: () => void; resolve(value: unknown): void; reject(reason: unknown): void }
  const tickets = new Set<QueueTicket>();
  let membershipLoaded = false;
  const loreReady = new Set<string>();
  const loreRevisions = new Map<string, string>();
  const lorePending = new Map<string, Promise<string | undefined>>();
  const pendingDocuments = new Map<string, SearchDocument | null>();
  const pendingMemberships = new Map<string, { kind: string; id: string; collections: string[] }>();
  let pendingDocumentBytes = 0;
  let pendingMembershipBytes = 0;
  const lorebookIds = new Set<string>();

  const assertOwner = (owner: number, client?: SearchWorkerClient): void => {
    if (disposed || owner !== epoch || (client && worker !== client)) throw new DOMException("search generation expired", "AbortError");
  };
  const assertRequest = (owner: number, signal?: AbortSignal, client?: SearchWorkerClient): void => {
    assertOwner(owner, client);
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  };
  const releaseTicket = (ticket: QueueTicket): void => {
    if (ticket.released) return;
    ticket.released = true;
    if (ticket.signal && ticket.abort) ticket.signal.removeEventListener("abort", ticket.abort);
    ticket.signal = undefined;
    ticket.abort = undefined;
    ticket.run = undefined;
    queuedOperations--;
    queuedBytes -= ticket.bytes;
    tickets.delete(ticket);
  };
  const cancelTicket = (ticket: QueueTicket, reason: unknown): void => {
    if (ticket.cancelled) return;
    ticket.cancelled = true;
    ticket.run = undefined;
    if (ticket.signal && ticket.abort) ticket.signal.removeEventListener("abort", ticket.abort);
    ticket.reject(reason);
  };
  const enqueue = <T,>(owner: number, bytes: number, run: () => Promise<T>, signal?: AbortSignal, onAccepted?: () => void): Promise<T> => {
    if (disposed) return Promise.reject(new Error("search service is disposed"));
    if (!Number.isSafeInteger(bytes) || bytes < 0 || queuedOperations >= MAX_QUEUED_OPERATIONS || queuedBytes + bytes > MAX_QUEUED_BYTES) {
      return Promise.reject(new Error("search operation queue is full"));
    }
    queuedOperations++;
    queuedBytes += bytes;
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const result = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse; });
    const ticket: QueueTicket = {
      owner, bytes, started: false, released: false, cancelled: false, signal,
      run: run as () => Promise<unknown>,
      resolve: (value) => resolve(value as T), reject,
    };
    tickets.add(ticket);
    onAccepted?.();
    if (signal) {
      ticket.abort = () => cancelTicket(ticket, new DOMException("aborted", "AbortError"));
      signal.addEventListener("abort", ticket.abort, { once: true });
      if (signal.aborted) ticket.abort();
    }
    operationTail = operationTail.then(async () => {
      if (ticket.cancelled) { releaseTicket(ticket); return; }
      ticket.started = true;
      if (ticket.signal && ticket.abort) ticket.signal.removeEventListener("abort", ticket.abort);
      ticket.abort = undefined;
      try {
        assertOwner(ticket.owner);
        const value = await ticket.run!();
        ticket.resolve(value);
      } catch (error) { ticket.reject(error); }
      finally { ticket.run = undefined; releaseTicket(ticket); }
    }).then(() => undefined, () => undefined);
    return result;
  };
  const clearState = (terminal = false): void => {
    epoch++;
    generation++;
    if (terminal) disposed = true;
    if (idle) clearTimeout(idle);
    idle = null;
    const previous = worker;
    worker = null;
    previous?.close();
    indexed = false;
    initializing = null;
    membershipLoaded = false;
    loreReady.clear();
    loreRevisions.clear();
    lorePending.clear();
    pendingDocuments.clear();
    pendingMemberships.clear();
    pendingDocumentBytes = 0;
    pendingMembershipBytes = 0;
    lorebookIds.clear();
    for (const ticket of tickets) {
      cancelTicket(ticket, new DOMException("search generation expired", "AbortError"));
    }
  };
  const touch = (): void => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => clearState(), IDLE_MS);
  };
  const ensureWorker = (owner: number): SearchWorkerClient => {
    assertOwner(owner);
    return worker ??= options.createWorker?.() ?? new SearchWorkerClient();
  };
  const enforceBudget = (client: SearchWorkerClient, scratchBytes = 0): void => {
    if (client.bytes + scratchBytes + derivedFamilyBytes(SHARD_FAMILY) > BUDGET) throw new Error("search memory budget exceeded");
  };
  const queueDocument = (kind: string, id: string, doc: SearchDocument | null): void => {
    const key = `${kind}\0${id}`;
    const prior = pendingDocuments.get(key);
    pendingDocumentBytes -= prior ? estimateDocument(prior) : prior === null ? 32 : 0;
    pendingDocumentBytes += doc ? estimateDocument(doc) : 32;
    if (pendingDocumentBytes > MAX_PENDING_BYTES) { clearState(); throw new Error("pending search updates exceed their admission limit"); }
    pendingDocuments.set(key, doc);
  };
  const queueMembership = (kind: string, id: string, collections: readonly string[]): void => {
    const key = `${kind}\0${id}`;
    const prior = pendingMemberships.get(key);
    pendingMembershipBytes -= prior ? prior.collections.reduce((sum, value) => sum + value.length * 3, 32) : 0;
    const copy = collections.map((value) => assertString(value, 240));
    const bytes = copy.reduce((sum, value) => sum + value.length * 3, 32);
    pendingMembershipBytes += bytes;
    if (pendingMembershipBytes > MAX_PENDING_BYTES) { clearState(); throw new Error("pending search memberships exceed their admission limit"); }
    pendingMemberships.set(key, { kind, id, collections: copy });
  };

  const indexLibrary = async (owner: number, signal?: AbortSignal): Promise<void> => {
    assertOwner(owner);
    if (indexed) return;
    if (initializing?.epoch === owner) return initializing.promise;
    const task = (async (): Promise<void> => {
      const client = ensureWorker(owner);
      const [entities, labels] = await Promise.all([options.store.list(), options.sourceLabels()]);
      assertRequest(owner, signal, client);
      if (entities.length > MAX_PIECES) throw new Error("search piece limit exceeded");
      let bytes = 0;
      let batch: SearchDocument[] = [];
      let batchBytes = 0;
      for (const entity of entities) {
        if (entity.kind === "lorebook") lorebookIds.add(entity.id);
        const doc = documentFor(entity, labels);
        const size = estimateDocument(doc);
        const messageSize = estimateMessageDocument(doc);
        if (messageSize > 1_500_000) throw new Error("search summary exceeds its worker message limit");
        bytes += size;
        if (bytes + client.bytes + derivedFamilyBytes(SHARD_FAMILY) > BUDGET) throw new Error("search inventory exceeds its 64 MiB budget");
        if (batch.length && (batch.length === BATCH || batchBytes + messageSize > 1_500_000)) {
          await client.request({ op: "upsert", docs: batch }, signal);
          assertOwner(owner, client);
          enforceBudget(client);
          batch = [];
          batchBytes = 0;
        }
        batch.push(doc);
        batchBytes += messageSize;
        if (batch.length === BATCH) {
          await client.request({ op: "upsert", docs: batch }, signal);
          assertOwner(owner, client);
          enforceBudget(client);
          batch = [];
          batchBytes = 0;
        }
      }
      if (batch.length) {
        await client.request({ op: "upsert", docs: batch }, signal);
        assertOwner(owner, client);
        enforceBudget(client);
      }
      while (pendingDocuments.size) {
        for (const [key, doc] of [...pendingDocuments]) {
          if (doc) await client.request({ op: "upsert", docs: [doc] }, signal);
          else { const split = key.indexOf("\0"); await client.request({ op: "remove", kind: key.slice(0, split), id: key.slice(split + 1) }, signal); }
          assertOwner(owner, client);
          const split = key.indexOf("\0");
          if (key.slice(0, split) === "lorebook") { if (doc) lorebookIds.add(doc.id); else lorebookIds.delete(key.slice(split + 1)); }
          if (pendingDocuments.get(key) === doc) {
            pendingDocuments.delete(key);
            pendingDocumentBytes -= doc ? estimateDocument(doc) : 32;
          }
        }
      }
      indexed = true;
      generation++;
    })();
    initializing = { epoch: owner, promise: task };
    try { await task; }
    catch (error) {
      if (owner === epoch && !disposed) clearState();
      throw error;
    }
    finally { if (initializing?.promise === task) initializing = null; }
  };

  const installShard = async (client: SearchWorkerClient, owner: number, id: string, shard: SearchShard, signal?: AbortSignal): Promise<void> => {
    assertOwner(owner, client);
    enforceBudget(client, searchShardBytes(shard));
    await client.request({ op: "lore-start", bookId: id, count: shard.entries.length }, signal);
    assertOwner(owner, client);
    let entries: SearchShard["entries"] = [];
    let bytes = 0;
    let offset = 0;
    const flush = async (): Promise<void> => {
      if (!entries.length) return;
      enforceBudget(client, bytes);
      await client.request({ op: "lore-chunk", bookId: id, offset, entries }, signal);
      assertRequest(owner, signal, client);
      offset += entries.length;
      entries = [];
      bytes = 0;
    };
    for (const entry of shard.entries) {
      const size = 64 + (entry.id.length + entry.title.length + entry.keys.reduce((n, key) => n + key.length, 0)) * 6;
      if (size > 1_500_000) throw new Error("lore entry exceeds its worker message limit");
      if (entries.length && (entries.length === LORE_BATCH || bytes + size > 1_500_000)) await flush();
      entries.push(entry);
      bytes += size;
    }
    await flush();
    await client.request({ op: "lore-end", bookId: id }, signal);
    assertOwner(owner, client);
    enforceBudget(client);
  };

  const ensureLore = async (id: string, owner: number, client: SearchWorkerClient, signal?: AbortSignal): Promise<string | undefined> => {
    assertOwner(owner, client);
    if (loreReady.has(id)) return loreRevisions.get(id);
    const pending = lorePending.get(id);
    if (pending) return pending;
    const task = (async (): Promise<string | undefined> => {
      const stored: StoredBody | null = options.store.readBodyVersioned ? await options.store.readBodyVersioned("lorebook", id) : null;
      assertRequest(owner, signal, client);
      const body = stored?.body ?? await options.store.readBody?.("lorebook", id);
      assertRequest(owner, signal, client);
      if (!body || typeof body !== "object") throw new Error("lorebook search source is unavailable");
      const book: LoreBookInput = stored
        ? createStoredLoreInput(id, body as LorebookBody, stored.revision)
        : { id, name: typeof (body as LorebookBody).name === "string" ? (body as LorebookBody).name : "", body: body as LorebookBody };
      const shard = await searchShard(book);
      assertRequest(owner, signal, client);
      await installShard(client, owner, id, shard, signal);
      loreReady.add(id);
      const revision = stored?.revision;
      if (revision) loreRevisions.set(id, revision);
      generation++;
      return revision;
    })();
    lorePending.set(id, task);
    try { return await task; }
    finally { if (lorePending.get(id) === task) lorePending.delete(id); }
  };

  const loadMemberships = async (owner: number, client: SearchWorkerClient, signal?: AbortSignal): Promise<void> => {
    if (membershipLoaded) return;
    const file = await options.readCollections();
    assertOwner(owner, client);
    if (!Array.isArray(file.collections) || file.collections.length > 100_000) throw new Error("collection index exceeds its admission limit");
    await client.request({ op: "membership-reset" }, signal);
    assertOwner(owner, client);
    let memberships: { kind: string; id: string; collectionId: string }[] = [];
    let bytes = 0;
    const flush = async (): Promise<void> => {
      if (!memberships.length) return;
      enforceBudget(client, bytes);
      await client.request({ op: "membership-batch", memberships }, signal);
      assertRequest(owner, signal, client);
      memberships = [];
      bytes = 0;
    };
    for (const collection of file.collections) {
      if (typeof collection.id !== "string" || collection.id.length > 240 || !Array.isArray(collection.members)) throw new Error("invalid collection membership source");
      for (const ref of collection.members) {
        if (typeof ref.kind !== "string" || typeof ref.id !== "string" || ref.kind.length > 80 || ref.id.length > 240) throw new Error("invalid collection membership source");
        memberships.push({ kind: ref.kind, id: ref.id, collectionId: collection.id });
        bytes += 48 + (ref.kind.length + ref.id.length + collection.id.length) * 6;
        if (memberships.length === BATCH) await flush();
      }
    }
    await flush();
    while (pendingMemberships.size) for (const [key, item] of [...pendingMemberships]) {
      await client.request({ op: "membership", kind: item.kind, id: item.id, collections: item.collections }, signal);
      assertOwner(owner, client);
      if (pendingMemberships.get(key) === item) {
        pendingMemberships.delete(key);
        pendingMembershipBytes -= item.collections.reduce((sum, value) => sum + value.length * 3, 32);
      }
    }
    membershipLoaded = true;
    generation++;
  };

  const mutate = async (fn: (owner: number, client: SearchWorkerClient) => Promise<void>): Promise<void> => {
    if (disposed) throw new Error("search service is disposed");
    touch();
    const owner = epoch;
    await indexLibrary(owner);
    assertOwner(owner);
    const client = ensureWorker(owner);
    try { await fn(owner, client); assertOwner(owner, client); }
    catch (error) { if (owner === epoch && worker === client) clearState(); throw error; }
  };

  return {
    async search(input, signal): Promise<SearchResponse> {
      if (disposed) throw new Error("search service is disposed");
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const { request: safe, bytes } = projectSearchRequest(input);
      touch();
      const owner = epoch;
      const startedMutation = mutationVersion;
      return enqueue(owner, bytes, async () => {
        assertOwner(owner);
        if (startedMutation !== mutationVersion) return { active: true, unknown: [], total: 0, available: 0, hits: [], generation, stale: true };
        try {
        await indexLibrary(owner, signal);
        assertOwner(owner);
        const client = ensureWorker(owner);
        const parsed = parseQuery(safe.query);
        if (safe.scope?.kind === "lorebook-entry") {
          const revision = await ensureLore(safe.scope.id, owner, client, signal);
          assertOwner(owner, client);
          if (safe.scope.revision && safe.scope.revision !== revision) return { active: false, unknown: [], total: 0, available: 0, hits: [], generation, stale: true };
        } else if (safe.scope?.kind === "lorebook-shelf" || queryUsesLoreKeys(parsed)) {
          for (const id of lorebookIds) { await ensureLore(id, owner, client, signal); assertOwner(owner, client); }
        }
        if (parsed.terms.some((term) => term.field === "collection")) await loadMemberships(owner, client, signal);
        assertOwner(owner, client);
        if (safe.generation !== undefined && safe.generation !== generation) return { active: parsed.active, unknown: parsed.unknown, total: 0, available: 0, hits: [], generation, stale: true };
        const snapshot = generation;
        const availableBytes = Math.max(0, BUDGET - client.bytes - derivedFamilyBytes(SHARD_FAMILY) - 2 * 1024 * 1024);
        const scratchLimit = Math.min(16 * 1024 * 1024, Math.floor(availableBytes / 2));
        const resultLimit = Math.max(0, Math.min(20_000, Math.floor((availableBytes - scratchLimit) / 1024)));
        const response = await client.request({ op: "search", input: safe, resultLimit, scratchLimit }, signal) as SearchResponse;
        assertOwner(owner, client);
        if (snapshot !== generation || startedMutation !== mutationVersion) return { active: response.active, unknown: response.unknown, total: 0, available: 0, hits: [], generation, stale: true };
        return { ...response, generation };
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError") && owner === epoch && !disposed) clearState();
          throw error;
        }
      }, signal);
    },
    async upsert(summary): Promise<void> {
      if (disposed) throw new Error("search service is disposed");
      const projected = projectSearchSummary(summary);
      const owner = epoch;
      return enqueue(owner, projected.bytes, async () => {
        assertOwner(owner);
        if (projected.summary.kind === "lorebook") { loreReady.delete(projected.summary.id); loreRevisions.delete(projected.summary.id); lorebookIds.add(projected.summary.id); }
        const labels = await options.sourceLabels();
        assertOwner(owner);
        const doc = documentFor(projected.summary, labels);
        if (!indexed) { queueDocument(doc.kind, doc.id, doc); return; }
        await mutate(async (activeOwner, client) => {
          await client.request({ op: "upsert", docs: [doc] });
          assertOwner(activeOwner, client);
        });
      }, undefined, () => { generation++; mutationVersion++; });
    },
    async remove(kind, id): Promise<void> {
      assertString(kind, 80); assertString(id, 240);
      if (disposed) throw new Error("search service is disposed");
      const owner = epoch;
      return enqueue(owner, 96 + (kind.length + id.length) * 2, async () => {
        assertOwner(owner);
        if (kind === "lorebook") { loreReady.delete(id); loreRevisions.delete(id); lorebookIds.delete(id); }
        if (!indexed) { queueDocument(kind, id, null); return; }
        await mutate(async (activeOwner, client) => { await client.request({ op: "remove", kind, id }); assertOwner(activeOwner, client); });
      }, undefined, () => { generation++; mutationVersion++; });
    },
    async setMemberships(kind, id, collectionIds): Promise<void> {
      assertString(kind, 80); assertString(id, 240);
      if (!Array.isArray(collectionIds) || collectionIds.length > 128 || collectionIds.some((value) => typeof value !== "string" || value.length > 240)) throw new TypeError("invalid collection membership update");
      if (disposed) throw new Error("search service is disposed");
      const copied = collectionIds.map((value) => assertString(value, 240));
      const bytes = 96 + (kind.length + id.length + copied.reduce((sum, value) => sum + value.length, 0)) * 2;
      const owner = epoch;
      return enqueue(owner, bytes, async () => {
        assertOwner(owner);
        if (!membershipLoaded) { queueMembership(kind, id, copied); return; }
        await mutate(async (activeOwner, client) => { await client.request({ op: "membership", kind, id, collections: copied }); assertOwner(activeOwner, client); });
      }, undefined, () => { generation++; mutationVersion++; });
    },
    invalidate: () => clearState(),
    dispose: () => clearState(true),
  };
}
