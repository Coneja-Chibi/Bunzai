/** Revision-keyed, rebuildable search projection for one lorebook's titles and primary keys. */
import { defineDerivePolicy, deriveAsync } from "../derive/derive";
import { hashHex } from "../sha256";
import type { LorebookBody } from "../../entities/lorebook/schema";
import { getStoredLoreRevision } from "../lore/engine/stored-input";
import type { LoreBookInput } from "../lore/engine/types";

export interface SearchShardEntry { id: string; title: string; keys: string[] }
export interface SearchShard { entries: SearchShardEntry[] }

const FAMILY = "search.shard";
const VERSION = "primary-title-v2";
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 100_000;
const MAX_KEYS = 200_000;
const MAX_ENTRY_KEYS = 4096;
const MAX_TEXT = 1024;
const HASH_CHUNK_BYTES = 256 * 1024;
function validShard(value: unknown): value is SearchShard {
  if (!value || typeof value !== "object") return false;
  const shard = value as SearchShard;
  if (Object.keys(shard).length !== 1 || !Array.isArray(shard.entries) || shard.entries.length > MAX_ENTRIES) return false;
  let bytes = 0;
  let keys = 0;
  for (const entry of shard.entries) {
    if (!entry || typeof entry !== "object" || Object.keys(entry).length !== 3 || typeof entry.id !== "string" || !entry.id || entry.id.length > 240 || typeof entry.title !== "string" || entry.title.length > MAX_TEXT || !Array.isArray(entry.keys) || entry.keys.length > MAX_ENTRY_KEYS) return false;
    bytes += (entry.id.length + entry.title.length) * 3;
    if (bytes > MAX_BYTES) return false;
    for (const key of entry.keys) {
      if (typeof key !== "string" || key.length > MAX_TEXT || ++keys > MAX_KEYS) return false;
      bytes += key.length * 3;
      if (bytes > MAX_BYTES) return false;
    }
  }
  return true;
}
const sizeOf = (value: SearchShard): number => {
  let bytes = 0;
  for (const entry of value.entries) {
    bytes += 24 + (entry.id.length + entry.title.length) * 3;
    for (const key of entry.keys) bytes += 8 + key.length * 3;
  }
  return bytes;
};
export const searchShardBytes = sizeOf;
const policy = defineDerivePolicy<SearchShard>(FAMILY, {
  version: VERSION,
  persist: "never",
  maxBytes: MAX_BYTES,
  memoryBytes: (_revision, value) => validShard(value) ? sizeOf(value) : MAX_BYTES + 1,
  decode: (raw) => {
    if (raw.length * 3 > MAX_BYTES) throw new TypeError("oversized search shard");
    const value: unknown = JSON.parse(raw);
    if (!validShard(value)) throw new TypeError("invalid search shard");
    return value as SearchShard;
  },
});

function sourceEntries(book: LoreBookInput): LorebookBody["entries"] {
  const source = (book.body as LorebookBody).entries ?? [];
  if (!Array.isArray(source) || source.length > MAX_ENTRIES) throw new TypeError("lore search entry limit exceeded");
  let budget = 0;
  let keys = 0;
  for (const entry of source) {
    if (typeof entry.id !== "string" || entry.id.length > 240 || typeof entry.title !== "string" || entry.title.length > MAX_TEXT || !Array.isArray(entry.triggers) || entry.triggers.length > MAX_ENTRY_KEYS) throw new TypeError("invalid lore search entry");
    keys += entry.triggers.length;
    if (keys > MAX_KEYS) throw new TypeError("lore search key limit exceeded");
    budget += 24 + (entry.id.length + entry.title.length) * 3 + entry.triggers.length * 8;
    if (budget > MAX_BYTES) throw new TypeError("lore search shard exceeds its 16 MiB limit");
    for (const trigger of entry.triggers) {
      if (typeof trigger.keyword !== "string" || trigger.keyword.length > MAX_TEXT) throw new TypeError("invalid lore search keyword");
      budget += trigger.keyword.length * 3;
      if (budget > MAX_BYTES) throw new TypeError("lore search shard exceeds its 16 MiB limit");
    }
  }
  return source;
}

function projectEntry(entry: NonNullable<LorebookBody["entries"]>[number]): SearchShardEntry {
  return { id: entry.id, title: entry.title, keys: entry.triggers.map((trigger) => trigger.keyword).filter(Boolean) };
}

function project(source: NonNullable<LorebookBody["entries"]>): SearchShardEntry[] {
  const output: SearchShardEntry[] = [];
  for (const entry of source) output.push(projectEntry(entry));
  return output;
}

function fingerprint(id: string, source: NonNullable<LorebookBody["entries"]>): string {
  const chunks: string[] = [];
  let batch: SearchShardEntry[] = [];
  let bytes = 0;
  const flush = (): void => { if (batch.length) chunks.push(hashHex(JSON.stringify(batch))); batch = []; bytes = 0; };
  for (const row of source) {
    const entry = projectEntry(row);
    const size = 24 + (entry.id.length + entry.title.length + entry.keys.reduce((sum, key) => sum + key.length, 0)) * 3;
    if (batch.length && bytes + size > HASH_CHUNK_BYTES) flush();
    batch.push(entry);
    bytes += size;
  }
  flush();
  return hashHex(`${id}\0${chunks.join("\0")}`);
}

/** Uses the stored immutable revision when available; mutable public inputs are fingerprinted. */
export function searchShard(book: LoreBookInput): Promise<SearchShard> {
  const stored = getStoredLoreRevision(book);
  const source = stored ? undefined : sourceEntries(book);
  const revision = stored ?? fingerprint(book.id, source!);
  return deriveAsync(FAMILY, revision, () => {
    const input = project(source ?? sourceEntries(book));
    return Promise.resolve({ entries: input });
  }, policy);
}
