/** One disposable SQLite FTS worker; it stores summaries and trigger keys, never bodies or escrow. */
import { Database } from "bun:sqlite";
import { parseQuery, queryUsesLoreKeys, scorePiece } from "../../core/search/query";
import { matchingLoreShelfBooks } from "../../core/search/lore-matching";
import { SEARCH_RESULT_CEILING, type SearchRequest, type SearchResponse } from "../../core/search/contracts";
import { orderedWorkerHits, rankedQuery, retainWorkerHit, workerPage, type RankedWorkerHit } from "../../core/search/worker-results";
import type { SearchShardEntry } from "../../core/search/shard";
import type { SearchDocument, SearchWorkerReply, SearchWorkerRequest } from "./search-protocol";
import { toErrorMessage } from "../../error-message";

declare const self: Worker;
const BUDGET = 64 * 1024 * 1024;
const MAX_DOCS = 100_000;
const MAX_TEXT = 4096;
const MAX_LORE_ENTRIES = 100_000;
const MAX_LORE_KEYS = 200_000;
const MAX_SHARD_BYTES = 16 * 1024 * 1024;
const db = new Database(":memory:", { strict: true });
db.run("PRAGMA temp_store = MEMORY");
db.run("CREATE TABLE docs (rowid INTEGER PRIMARY KEY, doc_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL, haystack TEXT NOT NULL, payload TEXT NOT NULL)");
db.run("CREATE VIRTUAL TABLE search_fts USING fts5(name,id,kind,source,haystack,content='docs',content_rowid='rowid')");
db.run("CREATE VIRTUAL TABLE name_trigram USING fts5(name,content='docs',content_rowid='rowid',tokenize='trigram')");
db.run("CREATE TABLE memberships (kind TEXT NOT NULL, id TEXT NOT NULL, collection_id TEXT NOT NULL, PRIMARY KEY(kind,id,collection_id)) WITHOUT ROWID");
db.run("CREATE TABLE lore_entries (book_id TEXT NOT NULL, entry_index INTEGER NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, keys TEXT NOT NULL, PRIMARY KEY(book_id,entry_index)) WITHOUT ROWID");
db.run("CREATE TRIGGER docs_ai AFTER INSERT ON docs BEGIN INSERT INTO search_fts(rowid,name,id,kind,source,haystack) VALUES(new.rowid,new.name,new.id,new.kind,new.source,new.haystack); INSERT INTO name_trigram(rowid,name) VALUES(new.rowid,new.name); END");
db.run("CREATE TRIGGER docs_ad AFTER DELETE ON docs BEGIN INSERT INTO search_fts(search_fts,rowid,name,id,kind,source,haystack) VALUES('delete',old.rowid,old.name,old.id,old.kind,old.source,old.haystack); INSERT INTO name_trigram(name_trigram,rowid,name) VALUES('delete',old.rowid,old.name); END");
db.run("CREATE TRIGGER docs_au AFTER UPDATE ON docs BEGIN INSERT INTO search_fts(search_fts,rowid,name,id,kind,source,haystack) VALUES('delete',old.rowid,old.name,old.id,old.kind,old.source,old.haystack); INSERT INTO name_trigram(name_trigram,rowid,name) VALUES('delete',old.rowid,old.name); INSERT INTO search_fts(rowid,name,id,kind,source,haystack) VALUES(new.rowid,new.name,new.id,new.kind,new.source,new.haystack); INSERT INTO name_trigram(rowid,name) VALUES(new.rowid,new.name); END");
const put = db.query("INSERT INTO docs(doc_key,kind,id,name,source,haystack,payload) VALUES($key,$kind,$id,$name,$source,$haystack,$payload) ON CONFLICT(doc_key) DO UPDATE SET kind=excluded.kind,id=excluded.id,name=excluded.name,source=excluded.source,haystack=excluded.haystack,payload=excluded.payload");
const docs = db.query("SELECT rowid,payload FROM docs WHERE kind!='lorebook-entry' ORDER BY rowid");
const byKey = db.query("SELECT rowid FROM docs WHERE doc_key=?");
let trackedBytes = 0;
let loreBytes = 0;
const loreBytesByBook = new Map<string, number>();
let buildingLore: { id: string; count: number; offset: number; keys: number; bytes: number; accountedBytes: number } | null = null;
const cancelledSearches = new Set<number>();
const pendingSearches = new Set<number>();

function docKey(kind: string, id: string): string { return `${kind}\0${id}`; }
function validateDoc(doc: SearchDocument): void {
  if (!doc || typeof doc.id !== "string" || !doc.id || doc.id.length > 240 || typeof doc.kind !== "string" || doc.kind.length > 80 || typeof doc.name !== "string" || doc.name.length > MAX_TEXT) throw new TypeError("invalid search document");
  if (doc.tags && (!Array.isArray(doc.tags) || doc.tags.length > 128 || doc.tags.some((tag) => typeof tag !== "string" || tag.length > 256))) throw new TypeError("invalid search tags");
  for (const text of [doc.sourceLabel, doc.sourceFormat, doc.sourceVariant, doc.provenance, doc.snippet]) if (text !== undefined && (typeof text !== "string" || text.length > MAX_TEXT)) throw new TypeError("invalid search document text");
}
function searchableText(doc: SearchDocument): string {
  return [doc.name, doc.id, doc.sourceLabel, doc.sourceFormat, doc.sourceVariant, doc.provenance, ...(doc.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
}
function storeDoc(doc: SearchDocument): void {
  validateDoc(doc);
  const key = docKey(doc.kind, doc.id);
  const old = byKey.get(key) as { rowid: number } | null;
  if (old) {
    const previous = db.query("SELECT length(payload) AS bytes FROM docs WHERE rowid=?").get(old.rowid) as { bytes: number } | null;
    trackedBytes -= (previous?.bytes ?? 0) * 2;
  }
  const payload = JSON.stringify(doc);
  trackedBytes += payload.length * 2;
  put.run({ $key: key, $kind: doc.kind, $id: doc.id, $name: doc.name.toLowerCase(), $source: `${doc.sourceLabel ?? ""} ${doc.sourceFormat ?? ""} ${doc.sourceVariant ?? ""}`.toLowerCase(), $haystack: searchableText(doc), $payload: payload });
}
function footprint(): number {
  const allocated = (db.query("PRAGMA page_count").get() as { page_count: number }).page_count * (db.query("PRAGMA page_size").get() as { page_size: number }).page_size;
  return trackedBytes + loreBytes + allocated;
}
function collectionsOf(kind: string, id: string): string[] | undefined {
  const rows = db.query("SELECT collection_id FROM memberships WHERE kind=? AND id=? ORDER BY collection_id").all(kind, id) as { collection_id: string }[];
  return rows.length ? rows.map((row) => row.collection_id) : undefined;
}
function loreKeys(bookId: string, scratchLimit: number): string[] {
  let bytes = 0;
  let count = 0;
  for (const row of db.query("SELECT keys FROM lore_entries WHERE book_id=? ORDER BY entry_index").iterate(bookId) as Iterable<{ keys: string }>) {
    const entries = JSON.parse(row.keys) as string[];
    bytes += row.keys.length * 12;
    count += entries.length;
    if (bytes + count * 24 > scratchLimit || footprint() + bytes + count * 24 > BUDGET) throw new Error("search shard scratch would exceed its memory budget");
  }
  const keys: string[] = [];
  for (const row of db.query("SELECT keys FROM lore_entries WHERE book_id=? ORDER BY entry_index").iterate(bookId) as Iterable<{ keys: string }>) {
    for (const key of JSON.parse(row.keys) as string[]) keys.push(key);
  }
  return keys;
}
function searchCancelled(id: number): boolean { return cancelledSearches.has(id); }
function yieldWorker(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 0)); }

async function search(input: SearchRequest, requestId: number, resultLimit: number, scratchLimit: number): Promise<SearchResponse | null> {
  const available = Math.min(SEARCH_RESULT_CEILING, Math.max(0, Math.floor(resultLimit)));
  const parsed = parseQuery(input.query);
  const limitKinds = input.kinds ? new Set(input.kinds) : null;
  if (input.scope?.kind === "lorebook-shelf") {
    const needle = input.query.trim().toLowerCase();
    const hits: SearchResponse["hits"][number][] = [];
    let total = 0;
    let scanned = 0;
    for (const row of db.query("SELECT payload FROM docs WHERE kind='lorebook' ORDER BY rowid").iterate() as Iterable<{ payload: string }>) {
      if (searchCancelled(requestId)) return null;
      const doc = JSON.parse(row.payload) as SearchDocument;
      doc.searchKeys = loreKeys(doc.id, scratchLimit);
      if (matchingLoreShelfBooks(needle, [doc]).length) {
        total++;
        if (hits.length < available) hits.push({ kind: doc.kind, id: doc.id, score: 0, snippet: doc.name.slice(0, 180) });
      }
      if (++scanned % 128 === 0) await yieldWorker();
    }
    return workerPage(input, total, hits, parsed.active, parsed.unknown, available);
  }
  if (input.scope?.kind === "lorebook-entry") {
    const query = input.query.trim().toLowerCase();
    let total = 0;
    const hits: SearchResponse["hits"][number][] = [];
    let scanned = 0;
    for (const row of db.query("SELECT entry_index,id,title,keys FROM lore_entries WHERE book_id=? ORDER BY entry_index").iterate(input.scope.id) as Iterable<{ entry_index: number; id: string; title: string; keys: string }>) {
      if (searchCancelled(requestId)) return null;
      if (!query || row.title.toLowerCase().includes(query) || (JSON.parse(row.keys) as string[]).some((key) => key.toLowerCase().includes(query))) {
        total++;
        if (hits.length < available) hits.push({ kind: "lorebook-entry", id: row.id, entryIndex: row.entry_index, score: 0, snippet: row.title.slice(0, 180) });
      }
      if (++scanned % 128 === 0) await yieldWorker();
    }
    return workerPage(input, total, hits, parsed.active, parsed.unknown, available);
  }
  const ranked = rankedQuery(parsed);
  const useKeys = queryUsesLoreKeys(parsed);
  const hits: RankedWorkerHit[] = [];
  let total = 0;
  let scanned = 0;
  let rows: Iterable<{ rowid: number; payload: string }> = docs.iterate() as Iterable<{ rowid: number; payload: string }>;
  const nameTerm = parsed.terms.find((term) => !term.negated && term.field === "name" && term.value.length >= 3);
  if (nameTerm && parsed.terms.every((term) => term.field === "name" || ["kind", "has", "collection"].includes(term.field))) {
    try { rows = db.query("SELECT docs.rowid,payload FROM name_trigram JOIN docs USING(rowid) WHERE name_trigram MATCH ? AND docs.kind!='lorebook-entry' ORDER BY docs.rowid").iterate(`name : \"${nameTerm.value.replaceAll('"', '""')}\"`) as Iterable<{ rowid: number; payload: string }>; }
    catch { /* The exact Core matcher below remains the authority if FTS syntax cannot express a query. */ }
  }
  for (const row of rows) {
    if (searchCancelled(requestId)) return null;
    if (++scanned % 128 === 0) await yieldWorker();
    const doc = JSON.parse(row.payload) as SearchDocument;
    if (limitKinds && !limitKinds.has(doc.kind)) continue;
    if (useKeys && doc.kind === "lorebook") doc.searchKeys = loreKeys(doc.id, scratchLimit);
    doc.collections = collectionsOf(doc.kind, doc.id);
    const score = scorePiece(doc, parsed.terms);
    if (score === null) continue;
    total++;
    retainWorkerHit(hits, { piece: { id: doc.id, kind: doc.kind, name: doc.name }, score, snippet: doc.snippet }, available, ranked);
  }
  return workerPage(input, total, orderedWorkerHits(hits, ranked), parsed.active, parsed.unknown, available);
}

let serialized: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  const message = event.data;
  if (message.op === "cancel") {
    if (pendingSearches.has(message.targetId)) cancelledSearches.add(message.targetId);
    self.postMessage({ requestId: message.requestId, ok: true, value: null } satisfies SearchWorkerReply);
    return;
  }
  if (message.op === "search") pendingSearches.add(message.requestId);
  serialized = serialized.then(async () => {
    let reply: SearchWorkerReply;
    try {
    if (message.op === "upsert") {
      if (!Array.isArray(message.docs) || message.docs.length > 64) throw new Error("search document limit exceeded");
      const unique = new Map<string, SearchDocument>();
      for (const doc of message.docs) { validateDoc(doc); unique.set(docKey(doc.kind, doc.id), doc); }
      const currentCount = (db.query("SELECT count(*) AS count FROM docs").get() as { count: number }).count;
      let additions = 0;
      let projected = footprint();
      for (const [key, doc] of unique) {
        const old = byKey.get(key) as { rowid: number } | null;
        if (!old) additions++;
        const oldBytes = old ? (db.query("SELECT length(payload) AS bytes FROM docs WHERE rowid=?").get(old.rowid) as { bytes: number }).bytes * 2 : 0;
        projected += JSON.stringify(doc).length * 2 - oldBytes;
      }
      if (currentCount + additions > MAX_DOCS) throw new Error("search document limit exceeded");
      if (projected > BUDGET) throw new Error("search index reached its 64 MiB admission limit");
      for (const doc of unique.values()) {
        storeDoc(doc);
        if (doc.kind === "lorebook") {
          loreBytes -= loreBytesByBook.get(doc.id) ?? 0;
          loreBytesByBook.delete(doc.id);
          db.query("DELETE FROM lore_entries WHERE book_id=?").run(doc.id);
        }
      }
      if (footprint() > BUDGET) throw new Error("search index reached its 64 MiB budget");
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "remove") {
      const row = byKey.get(docKey(message.kind, message.id)) as { rowid: number } | null;
      if (row) {
        const old = db.query("SELECT length(payload) AS bytes FROM docs WHERE rowid=?").get(row.rowid) as { bytes: number };
        trackedBytes -= old.bytes * 2;
        db.query("DELETE FROM docs WHERE rowid=?").run(row.rowid);
      }
      db.query("DELETE FROM memberships WHERE kind=? AND id=?").run(message.kind, message.id);
      if (message.kind === "lorebook") {
        loreBytes -= loreBytesByBook.get(message.id) ?? 0;
        loreBytesByBook.delete(message.id);
        db.query("DELETE FROM lore_entries WHERE book_id=?").run(message.id);
      }
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "membership-reset") {
      db.run("DELETE FROM memberships");
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "membership-batch") {
      if (message.memberships.length > 64) throw new Error("membership batch exceeds its admission limit");
      for (const item of message.memberships) {
        if (typeof item.kind !== "string" || typeof item.id !== "string" || typeof item.collectionId !== "string" || item.kind.length > 80 || item.id.length > 240 || item.collectionId.length > 240) throw new Error("invalid collection membership");
      }
      const size = message.memberships.reduce((sum, item) => sum + 48 + (item.kind.length + item.id.length + item.collectionId.length) * 6, 0);
      if (footprint() + size > BUDGET) throw new Error("search memberships exceed their admission budget");
      const putMembership = db.query("INSERT OR IGNORE INTO memberships(kind,id,collection_id) VALUES(?,?,?)");
      for (const item of message.memberships) putMembership.run(item.kind, item.id, item.collectionId);
      if (footprint() > BUDGET) throw new Error("search memberships reached their memory budget");
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "membership") {
      if (typeof message.kind !== "string" || typeof message.id !== "string" || !Array.isArray(message.collections) || message.kind.length > 80 || message.id.length > 240 || message.collections.length > 128 || message.collections.some((id) => typeof id !== "string" || id.length > 240)) throw new Error("invalid collection membership");
      const size = 48 + (message.kind.length + message.id.length + message.collections.reduce((n, id) => n + id.length, 0)) * 6;
      if (footprint() + size > BUDGET) throw new Error("search membership exceeds its admission budget");
      db.query("DELETE FROM memberships WHERE kind=? AND id=?").run(message.kind, message.id);
      const putMembership = db.query("INSERT INTO memberships(kind,id,collection_id) VALUES(?,?,?)");
      for (const id of message.collections) putMembership.run(message.kind, message.id, id);
      if (footprint() > BUDGET) throw new Error("search memberships reached their memory budget");
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "lore-start") {
      if (!Number.isSafeInteger(message.count) || message.count < 0 || message.count > MAX_LORE_ENTRIES || typeof message.bookId !== "string" || !message.bookId || message.bookId.length > 240) throw new Error("lore search entry limit exceeded");
      loreBytes -= loreBytesByBook.get(message.bookId) ?? 0;
      loreBytesByBook.delete(message.bookId);
      db.query("DELETE FROM lore_entries WHERE book_id=?").run(message.bookId);
      buildingLore = { id: message.bookId, count: message.count, offset: 0, keys: 0, bytes: 0, accountedBytes: 0 };
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "lore-chunk") {
      if (!buildingLore || buildingLore.id !== message.bookId || buildingLore.offset !== message.offset || message.entries.length > 128 || message.offset + message.entries.length > buildingLore.count) throw new Error("invalid lore shard chunk");
      let added = 0;
      let keys = 0;
      for (const entry of message.entries) {
        if (typeof entry.id !== "string" || !entry.id || entry.id.length > 240 || typeof entry.title !== "string" || entry.title.length > 1024 || !Array.isArray(entry.keys) || entry.keys.length > 4096 || entry.keys.some((key) => typeof key !== "string" || key.length > 1024)) throw new Error("invalid lore search entry");
        keys += entry.keys.length;
        added += 32 + (entry.id.length + entry.title.length) * 3 + entry.keys.length * 8 + entry.keys.reduce((n, key) => n + key.length * 3, 0);
      }
      if (buildingLore.keys + keys > MAX_LORE_KEYS || buildingLore.bytes + added > MAX_SHARD_BYTES || footprint() + added > BUDGET) throw new Error("lore search shard exceeds its admission budget");
      const encoded = message.entries.map((entry) => JSON.stringify(entry.keys));
      const accounted = message.entries.reduce((sum, entry, index) => sum + 32 + (entry.id.length + entry.title.length + encoded[index]!.length) * 2, 0);
      const insert = db.query("INSERT INTO lore_entries(book_id,entry_index,id,title,keys) VALUES(?,?,?,?,?)");
      message.entries.forEach((entry, index) => insert.run(message.bookId, message.offset + index, entry.id, entry.title, encoded[index]!));
      loreBytes += added;
      buildingLore.offset += message.entries.length;
      buildingLore.keys += keys;
      buildingLore.bytes += added;
      buildingLore.accountedBytes += accounted;
      if (footprint() > BUDGET) throw new Error("lore search shard reached its memory budget");
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "lore-end") {
      if (!buildingLore || buildingLore.id !== message.bookId || buildingLore.offset !== buildingLore.count) throw new Error("incomplete lore search shard");
      loreBytes += buildingLore.accountedBytes + 64 - buildingLore.bytes;
      loreBytesByBook.set(message.bookId, buildingLore.accountedBytes + 64);
      buildingLore = null;
      reply = { requestId: message.requestId, ok: true, value: { bytes: footprint() } };
    } else if (message.op === "search") {
      try {
        if (!Number.isSafeInteger(message.resultLimit) || message.resultLimit < 0 || message.resultLimit > SEARCH_RESULT_CEILING || !Number.isSafeInteger(message.scratchLimit) || message.scratchLimit < 0 || message.scratchLimit > BUDGET) throw new Error("invalid search memory capacity");
        const result = await search(message.input, message.requestId, message.resultLimit, message.scratchLimit);
        reply = { requestId: message.requestId, ok: true, value: result };
      } finally { pendingSearches.delete(message.requestId); cancelledSearches.delete(message.requestId); }
    }
    else { db.close(true); (self as unknown as { close(): void }).close(); reply = { requestId: message.requestId, ok: true, value: null }; }
    } catch (error) {
      reply = { requestId: message.requestId, ok: false, reason: toErrorMessage(error, "search worker failed") };
    }
    self.postMessage(reply);
  });
};
