/**
 * Kit's engine seam: in-process, read-side access to the studio through StudioStore.
 * Kit is a thin shell over the same engine the studio UI drives; nothing here reaches a
 * network or a model. The agent loop and every tool touch the studio only through this bridge,
 * so the surface stays small and the trust boundary stays in one place.
 */
import { isColdReadLimit } from "../stage/contracts/content-store";
import { homedir } from "node:os";
import {
  type CompareCreateResult,
  type CompareSaveResult,
  type EntitySummary,
} from "../studio/store";
import { openStudio } from "../foreign-reader";
import { CollectionsStore } from "../studio/collections";
import { EMPTY_COLLECTIONS, type CollectionsFile } from "../studio/collections-shape";
import { resolveDefaultStudioDir } from "../studio/resolve-dir";
import { KINDS, type KindId } from "../generated/kinds";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";

export type { EntitySummary } from "../studio/store";

/** A canonical entity as the engine parsed it; tools read this, never raw files. */
export type KitEntity = ParsedCanonicalEntity;

export interface DeckCount {
  kind: KindId;
  label: string;
  count: number;
}

export interface KitBridge {
  /** Absolute path of the studio this Kit session is bound to. */
  studioDir: string;
  /** One row per deck kind, in canonical order, with its live entity count. */
  deckCounts(): Promise<DeckCount[]>;
  /** Every entity summary, or just one deck kind's. Bad kinds resolve to []. */
  list(kind?: string): Promise<EntitySummary[]>;
  /**
   * Files in the studio folder that are NOT listed, grouped by why.
   *
   * Exists because the alternative is what Kit did before: a folder of 147 preset files listed three
   * and mentioned nothing. A count that quietly excludes most of a folder is worse than a smaller
   * count, because it reads as the folder being smaller.
   */
  unlisted?(kind?: string): Promise<{ reason: string; count: number; examples: string[] }[]>;
  /**
   * The person's own groupings of pieces, or none when they have made none.
   *
   * READ-ONLY ON PURPOSE. Collections are somebody's filing of their own studio, and an agent
   * quietly reorganising that is a worse surprise than one editing a piece - a piece edit is staged
   * and reviewed, while a regrouping would look like the app rearranged itself. The agent gets to
   * SEE the groupings and follow them; making and breaking them stays a human action.
   */
  collections?(): Promise<CollectionsFile>;
  /** One canonical entity, or null if the kind/id is unknown or unreadable. */
  read(kind: string, id: string): Promise<KitEntity | null>;
  /** Save (create, or overwrite when opts.overwrite) a canonical entity; returns its summary. A real
   * write failure throws (the dispatch turns it into a readable tool result). Every write reaches the
   * studio only after the safety gate has allowed it, upstream in gated-dispatch. */
  save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary>;
  /** Create only when the requested id is absent, under the backend's per-path write lock. */
  compareAndCreate?(raw: unknown): Promise<CompareCreateResult>;
  /**
   * The id a new piece asking for `id` would get (the store's answer: never a live id, never a
   * deleted one, since deleted ids are retired for good). Creates pick their id with it.
   */
  freeId?(kind: string, id: string): Promise<string>;
  /** Overwrite only when the stored entity still has the expected complete canonical revision. */
  compareAndSave?(raw: unknown, expectedRevision: string): Promise<CompareSaveResult>;
  /** Delete one entity; true when a file was actually removed. Tolerant: a bad kind/id resolves false. */
  delete(kind: string, id: string): Promise<boolean>;
}

/** Bind a Kit session to a studio directory (defaults to the machine's studio). */
export function createBridge(
  studioDir: string = resolveDefaultStudioDir(homedir()),
): KitBridge {
  // The reader used to live in this file, which is exactly why the desktop window did not have one.
  const store = openStudio(studioDir);
  const groupings = new CollectionsStore(studioDir);
  return {
    studioDir,
    async deckCounts(): Promise<DeckCount[]> {
      const tallies = new Map<string, number>();
      for (const entity of await store.list()) {
        tallies.set(entity.kind, (tallies.get(entity.kind) ?? 0) + 1);
      }
      return KINDS.map((k) => ({ kind: k.id, label: k.plural, count: tallies.get(k.id) ?? 0 }));
    },
    async list(kind?: string): Promise<EntitySummary[]> {
      try {
        return await store.list(kind);
      } catch {
        return [];
      }
    },
    async unlisted(kind?: string) {
      try {
        const { damaged } = await store.inventory(kind);
        const byReason = new Map<string, string[]>();
        for (const entry of damaged) {
          const names = byReason.get(entry.reason) ?? [];
          names.push(entry.id);
          byReason.set(entry.reason, names);
        }
        // Examples, not the whole list: naming three is enough to recognise which files are meant,
        // and a hundred filenames in a transcript line is its own kind of unreadable.
        return [...byReason].map(([reason, names]) => ({
          reason,
          count: names.length,
          examples: names.slice(0, 3),
        }));
      } catch {
        return [];
      }
    },
    async collections(): Promise<CollectionsFile> {
      try {
        return await groupings.read();
      } catch {
        // A grouping file nobody can read is no groupings, never a broken session.
        return EMPTY_COLLECTIONS;
      }
    },
    async read(kind: string, id: string): Promise<KitEntity | null> {
      try {
        return await store.read(kind, id);
      } catch (error) {
        // Over the whole-piece budget (a big pack): the agent sees it with pictures as references, never as base64.
        if (isColdReadLimit(error)) return ((await store.readLight?.(kind, id))?.entity ?? null) as KitEntity | null;
        return null;
      }
    },
    async save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary> {
      return store.save(raw, opts);
    },
    async freeId(kind: string, id: string): Promise<string> {
      return store.freeId(kind, id);
    },
    async compareAndCreate(raw: unknown): Promise<CompareCreateResult> {
      return store.compareAndCreate(raw);
    },
    async compareAndSave(raw: unknown, expectedRevision: string): Promise<CompareSaveResult> {
      return store.compareAndSave(raw, expectedRevision);
    },
    async delete(kind: string, id: string): Promise<boolean> {
      try {
        return await store.delete(kind, id);
      } catch {
        return false;
      }
    },
  };
}
