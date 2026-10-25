/** Owns one portable search index and committed-journal cursor for an opened library. */
import * as registry from "../core/registry";
import type { DocumentBackend } from "../stage/contracts/content-store";
import { createSearchService, type SearchService } from "../stage/search/search-service";
import type { createKeyring } from "../stage/crypto/keyring";
import type { StudioStoreLike } from "../studio/contracts";
import { CollectionsStore } from "../studio/collections";
import type { CollectionsFile } from "../studio/collections-shape";
import { createPieceChangeReplay } from "../stage/store/piece-change-replay";

export function collectionMemberships(file: CollectionsFile): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const group of file.collections) for (const member of group.members) {
    const key = `${member.kind}\0${member.id}`;
    const ids = result.get(key);
    if (ids) ids.push(group.id);
    else result.set(key, [group.id]);
  }
  return result;
}

export async function applyMembershipDiff(service: SearchService, previous: Map<string, string[]>, next: Map<string, string[]>, current: () => boolean = () => true): Promise<void> {
  for (const key of new Set([...previous.keys(), ...next.keys()])) {
    if (!current()) throw new Error("library search changed while updating memberships");
    const ids = next.get(key) ?? [];
    if (ids.length === (previous.get(key)?.length ?? 0) && ids.every((id, i) => id === previous.get(key)?.[i])) continue;
    const [kind, id] = key.split("\0");
    await service.setMemberships(kind!, id!, ids);
  }
}

export interface LibrarySearch {
  readonly service: SearchService;
  search(input: Parameters<SearchService["search"]>[0], signal?: AbortSignal): Promise<Awaited<ReturnType<SearchService["search"]>>>;
  refreshMemberships(): Promise<void>;
  close(): void;
}

/** Bind lazy worker creation, lock invalidation and targeted committed-write replay to this library. */
export function createLibrarySearch(input: {
  dir: string; store: StudioStoreLike; backend: DocumentBackend; keyring: ReturnType<typeof createKeyring>;
}): LibrarySearch {
  const collections = new CollectionsStore(input.dir);
  const service = createSearchService({
    store: input.store,
    readCollections: () => collections.read(),
    sourceLabels: async () => new Map(registry.all().map((adapter) => [adapter.id, adapter.label])),
  });
  let closed = false;
  let lockGeneration = 0;
  let knownMemberships = new Map<string, string[]>();
  const stopLock = input.keyring.onDropKeys(() => { lockGeneration++; knownMemberships.clear(); service.invalidate(); });
  const replay = createPieceChangeReplay(input.backend, async (event) => {
    if (event.action === "delete") { await service.remove(event.kind, event.id); return; }
    if (!input.store.summary) throw new Error("targeted studio summaries are unavailable");
    const summary = await input.store.summary(event.kind, event.id);
    if (!summary) { await service.remove(event.kind, event.id); return; }
    if ((summary.writeId ?? 0) > event.writeId) return;
    if (summary.writeId !== event.writeId || summary.revision !== event.revision) throw new Error("search summary does not match its committed receipt");
    await service.upsert(summary);
  }, () => service.invalidate());
  return {
    service,
    async search(request, signal) {
      await replay.replay();
      if (closed) throw new Error("library search is closed");
      return service.search(request, signal);
    },
    async refreshMemberships() {
      const generation = lockGeneration;
      const current = (): boolean => !closed && generation === lockGeneration;
      if (!current()) throw new Error("library search is closed");
      const memberships = collectionMemberships(await collections.read());
      if (!current()) throw new Error("library search changed while reading memberships");
      await applyMembershipDiff(service, knownMemberships, memberships, current);
      if (!current()) throw new Error("library search changed while updating memberships");
      knownMemberships = memberships;
    },
    close() { if (closed) return; closed = true; lockGeneration++; knownMemberships.clear(); replay.close(); stopLock(); service.dispose(); },
  };
}
