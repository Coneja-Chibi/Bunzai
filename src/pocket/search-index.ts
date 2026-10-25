/** Worker-owned portable search summaries, memberships and bounded lore shards. */
import { searchMessageBytes } from "../core/search/worker-admission";
import type { SearchDocument, SearchWorkerRequest } from "../stage/search/search-protocol";
import type { SearchShardEntry } from "../core/search/shard";

export const SEARCH_BYTES = 64 * 1024 * 1024;
const keyOf = (kind: string, id: string): string => `${kind}\0${id}`;
function text(value: unknown, max: number): asserts value is string {
  if (typeof value !== "string" || !value || value.length > max) throw new Error("invalid search identity");
}
function document(doc: SearchDocument): void {
  text(doc.kind, 80); text(doc.id, 240);
  if (typeof doc.name !== "string" || doc.name.length > 4096 || typeof doc.snippet !== "string" || doc.snippet.length > 4096) throw new Error("invalid search document");
  for (const value of [doc.sourceLabel, doc.sourceFormat, doc.sourceVariant, doc.provenance]) if (value !== undefined && value !== null && (typeof value !== "string" || value.length > 4096)) throw new Error("invalid search text");
  if (doc.tags && (!Array.isArray(doc.tags) || doc.tags.length > 128 || doc.tags.some((tag) => typeof tag !== "string" || tag.length > 256))) throw new Error("invalid search tags");
}
type Charged<T> = { value: T; bytes: number };
export class PocketSearchIndex {
  constructor(private readonly reservations: () => number = () => 0) {}
  readonly documents = new Map<string, Charged<SearchDocument>>();
  readonly memberships = new Map<string, Charged<string[]>>();
  readonly lore = new Map<string, Charged<SearchShardEntry[]>>();
  private building: { id: string; count: number; keys: number; bytes: number; entries: SearchShardEntry[] } | null = null;
  private used = 0;
  get bytes(): number { return this.used + (this.building?.bytes ?? 0); }
  collections(kind: string, id: string): readonly string[] | undefined { return this.memberships.get(keyOf(kind, id))?.value; }
  private admit(projected: number): void { if (projected + (this.building?.bytes ?? 0) + this.reservations() > SEARCH_BYTES) throw new Error("search memory budget exceeded"); }
  private deleteLore(id: string): void { this.used -= this.lore.get(id)?.bytes ?? 0; this.lore.delete(id); }
  mutate(message: Exclude<SearchWorkerRequest, { op: "search" | "cancel" | "dispose" }>): void {
    if (message.op === "upsert") {
      if (!Array.isArray(message.docs) || message.docs.length > 64) throw new Error("invalid search batch");
      const changes = new Map<string, Charged<SearchDocument>>();
      for (const doc of message.docs) { document(doc); changes.set(keyOf(doc.kind, doc.id), { value: doc, bytes: 192 + searchMessageBytes(doc) }); }
      let size = this.documents.size, bytes = this.used;
      for (const [key, item] of changes) { const old = this.documents.get(key); if (!old) size++; bytes += item.bytes - (old?.bytes ?? 0); }
      if (size > 100_000) throw new Error("search document limit exceeded");
      this.admit(bytes);
      this.used = bytes;
      for (const [key, item] of changes) { this.documents.set(key, item); if (item.value.kind === "lorebook") this.deleteLore(item.value.id); }
    } else if (message.op === "remove") {
      text(message.kind, 80); text(message.id, 240);
      const key = keyOf(message.kind, message.id);
      this.used -= (this.documents.get(key)?.bytes ?? 0) + (this.memberships.get(key)?.bytes ?? 0);
      this.documents.delete(key); this.memberships.delete(key);
      if (message.kind === "lorebook") this.deleteLore(message.id);
    } else if (message.op === "membership-reset") {
      for (const item of this.memberships.values()) this.used -= item.bytes;
      this.memberships.clear();
    } else if (message.op === "membership" || message.op === "membership-batch") {
      const changes = new Map<string, Charged<string[]>>();
      const add = (kind: string, id: string, ids: string[], replace: boolean): void => {
        text(kind, 80); text(id, 240);
        if (!Array.isArray(ids) || ids.length > 128) throw new Error("invalid membership count");
        for (const collection of ids) text(collection, 240);
        const key = keyOf(kind, id);
        const previous = changes.get(key) ?? this.memberships.get(key);
        const value = [...new Set([...(replace ? [] : previous?.value ?? []), ...ids])];
        if (replace && value.length > 128) throw new Error("invalid membership count");
        changes.set(key, { value, bytes: 128 + key.length * 6 + value.reduce((bytes, collection) => bytes + 32 + collection.length * 6, 0) });
      };
      if (message.op === "membership") add(message.kind, message.id, message.collections, true);
      else {
        if (!Array.isArray(message.memberships) || message.memberships.length > 64) throw new Error("invalid membership batch");
        for (const item of message.memberships) add(item.kind, item.id, [item.collectionId], false);
      }
      let bytes = this.used;
      for (const [key, item] of changes) bytes += item.bytes - (this.memberships.get(key)?.bytes ?? 0);
      this.admit(bytes); this.used = bytes;
      for (const [key, item] of changes) this.memberships.set(key, item);
    } else if (message.op === "lore-start") {
      text(message.bookId, 240);
      if (!Number.isSafeInteger(message.count) || message.count < 0 || message.count > 100_000) throw new Error("invalid lore entry count");
      if (this.building) throw new Error("another lore shard is incomplete");
      this.admit(this.used + 128 + message.bookId.length * 6);
      this.building = { id: message.bookId, count: message.count, keys: 0, bytes: 128 + message.bookId.length * 6, entries: [] };
    } else if (message.op === "lore-chunk") {
      const building = this.building;
      if (!building || building.id !== message.bookId || building.entries.length !== message.offset || !Array.isArray(message.entries) || message.entries.length > 128 || message.offset + message.entries.length > building.count) throw new Error("invalid lore chunk");
      let keys = 0, bytes = 0;
      for (const entry of message.entries) {
        text(entry.id, 240);
        if (typeof entry.title !== "string" || entry.title.length > 1024 || !Array.isArray(entry.keys) || entry.keys.length > 4096 || entry.keys.some((key) => typeof key !== "string" || key.length > 1024)) throw new Error("invalid lore entry");
        keys += entry.keys.length; bytes += 96 + searchMessageBytes(entry);
      }
      if (building.keys + keys > 200_000 || building.bytes + bytes > 16 * 1024 * 1024) throw new Error("lore shard exceeds its memory budget");
      this.admit(this.used + bytes);
      building.keys += keys; building.bytes += bytes;
      building.entries.push(...message.entries);
    } else if (message.op === "lore-end") {
      const building = this.building;
      if (!building || building.id !== message.bookId || building.entries.length !== building.count) throw new Error("incomplete lore shard");
      this.deleteLore(building.id);
      this.lore.set(building.id, { value: building.entries, bytes: building.bytes });
      this.used += building.bytes; this.building = null;
    } else throw new Error("unknown search command");
  }
}
