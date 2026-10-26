/**
 * One lorebook's edit session: the loaded copy and its revision, the base the library last accepted, the load generation and the save queue. The World wing keeps one session per book it
 * shows, so the Messenger's all-books list can edit several books at once: each book loads, measures its patch and saves in its own queue against its own revision, and a 409 reloads
 * only that book. Full Chat runs the same sessions with a single book open. Entry edits write the LIBRARY book (`patchEditedEntity`), as a send-only-changed patch.
 */
import type { LorebookBody, LorebookEntry } from "../../../entities/lorebook/schema";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import type { AppContext } from "../../app-contract";
import { ApiHttpError } from "../../_shared/api-fetch";
import type { AsyncState } from "../../_shared/async-state";
import { buildPiecePatch } from "../../_shared/editor-patch";
import { toErrorMessage } from "../../_shared/error-message";

export type LoreEntity = { kind: string; id: string; body: LorebookBody };
export type LoreReady = { entity: LoreEntity; revision: string };
export type LoreBookState = AsyncState<LoreReady, { state: "none" } | { state: "gone" }>;
export type SaveIntent = "manual" | "autosave";

type LoreApiPort = Pick<AppContext["api"], "getLightEditableEntity" | "patchEditedEntity">;

export interface LoreSessionDeps {
  api(): LoreApiPort;
  /** False once the owner has gone: nothing is reported after that. */
  alive(): boolean;
  onState(id: string, state: LoreBookState): void;
  /** +1 when a save is queued, -1 when it settles (the footer's Saving line). */
  onSaving(delta: 1 | -1): void;
  /** A save met a 409: the book was reloaded and the edit was not saved. */
  onStale(id: string): void;
  /** A save the caller gave no failure handler for was refused. */
  onError(id: string, message: string): void;
}

export interface SaveHooks {
  onSaved?(entity: LoreEntity): void;
  onFailed?(message: string): void;
}

export interface LoreBookSession {
  readonly id: string;
  /** Bumps on every load: a save or edit tied to an older generation is dropped. */
  generation(): number;
  state(): LoreBookState;
  /** Reads the book fresh from the library. */
  load(): Promise<void>;
  /** Applies a change to the loaded copy at once; false when nothing is loaded or the change was a no-op. */
  apply(mutate: (entries: LorebookEntry[]) => LorebookEntry[]): boolean;
  /** Queues a save of whatever the loaded copy holds at its own turn; the dirty check is the patch itself. */
  save(gen: number, intent: SaveIntent, hooks?: SaveHooks): void;
  /** Resolves when every queued save has settled. */
  idle(): Promise<void>;
}

function createSession(id: string, deps: LoreSessionDeps): LoreBookSession {
  let generation = 0;
  let current: LoreReady | null = null;
  /** What the library last accepted: the base this book's saves are measured against. */
  let accepted: LoreEntity | null = null;
  let queue: Promise<void> = Promise.resolve();
  let state: LoreBookState = { state: "none" };
  const publish = (next: LoreBookState): void => {
    state = next;
    if (deps.alive()) deps.onState(id, next);
  };

  const load = async (): Promise<void> => {
    const mine = ++generation;
    current = null;
    accepted = null;
    publish({ state: "loading" });
    try {
      const found = await deps.api().getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(id)}`);
      if (mine !== generation) return;
      const entity = found.entity as LoreEntity;
      if (entity?.kind !== "lorebook") return publish({ state: "gone" });
      current = { entity, revision: found.revision };
      accepted = entity;
      publish({ state: "ready", ...current });
    } catch (e) {
      if (mine !== generation) return;
      publish(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the book could not be read") });
    }
  };

  const apply = (mutate: (entries: LorebookEntry[]) => LorebookEntry[]): boolean => {
    const cur = current;
    if (!cur) return false;
    const nextEntries = mutate(cur.entity.body.entries);
    if (nextEntries === cur.entity.body.entries) return false;
    current = { entity: { ...cur.entity, body: { ...cur.entity.body, entries: nextEntries } }, revision: cur.revision };
    publish({ state: "ready", ...current });
    return true;
  };

  // Each save is sent for whatever `current` holds at ITS OWN turn (read fresh right before the request), so a second action queued while the first is in flight is never lost: it was
  // already folded into `current` before its own save was queued, and a save's response only advances the revision.
  const save = (gen: number, intent: SaveIntent, hooks: SaveHooks = {}): void => {
    deps.onSaving(1);
    queue = queue.then(async () => {
      try {
        // Typed or clicked against a load this session has since replaced: saving it would overwrite what came in.
        if (gen !== generation) return;
        const cur = current;
        const base = accepted;
        if (!cur || !base) return;
        // Only what differs from the accepted copy travels: one entry, or the swapped pair, never the book.
        const patch = buildPiecePatch(base as unknown as ParsedCanonicalEntity, cur.entity as unknown as ParsedCanonicalEntity);
        if (!patch.items && !patch.order) return;
        const saved = await deps.api().patchEditedEntity("lorebook", cur.entity.id, cur.revision, patch, undefined, intent);
        if (!deps.alive() || gen !== generation) return;
        accepted = cur.entity;
        current = { entity: current!.entity, revision: saved.revision };
        publish({ state: "ready", ...current });
        hooks.onSaved?.(cur.entity);
      } catch (e) {
        if (!deps.alive()) return;
        if (e instanceof ApiHttpError && e.status === 409) {
          if (gen !== generation) return;
          await load();
          deps.onStale(id);
        } else {
          const message = toErrorMessage(e, "the library refused it");
          if (hooks.onFailed) hooks.onFailed(message);
          else deps.onError(id, message);
        }
      } finally {
        if (deps.alive()) deps.onSaving(-1);
      }
    });
  };

  return { id, generation: () => generation, state: () => state, load, apply, save, idle: () => queue };
}

export interface LoreBookSessions {
  /** The session for a book, created (not loaded) on first ask. Asking again cancels a pending drop. */
  ensure(id: string): LoreBookSession;
  get(id: string): LoreBookSession | undefined;
  ids(): string[];
  /** Forgets a book once its queued saves have settled. */
  drop(id: string): void;
  /** Resolves when every session's queue is empty and every pending drop is done. */
  idle(): Promise<void>;
}

/** A map of sessions keyed by book id: no two books ever share a queue, a revision, or an accepted base. */
export function createLoreBookSessions(deps: LoreSessionDeps): LoreBookSessions {
  const sessions = new Map<string, LoreBookSession>();
  const dropping = new Map<string, Promise<void>>();
  const wanted = new Set<string>();
  return {
    ensure(id) {
      wanted.add(id);
      let s = sessions.get(id);
      if (!s) {
        s = createSession(id, deps);
        sessions.set(id, s);
      }
      return s;
    },
    get: (id) => sessions.get(id),
    ids: () => [...sessions.keys()],
    drop(id) {
      const s = sessions.get(id);
      if (!s || dropping.has(id)) return;
      wanted.delete(id);
      const done = s.idle().then(() => {
        dropping.delete(id);
        if (!wanted.has(id) && sessions.get(id) === s) sessions.delete(id);
      });
      dropping.set(id, done);
    },
    async idle() {
      for (;;) {
        await Promise.all([...sessions.values()].map((s) => s.idle()));
        const drops = [...dropping.values()];
        if (drops.length === 0) return;
        await Promise.all(drops);
      }
    },
  };
}
