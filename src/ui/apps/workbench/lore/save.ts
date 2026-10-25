/** Lorebook adapter for the shared editor save lifecycle; preserves Marinara folder escrow as a narrow raw patch. */
import type { AppContext } from "../../../app-contract";
import { isRecord } from "../../../../core/guards";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { applyPiecePatch, buildPiecePatch, buildTouchedPatch, type EditorSaveAdapter } from "../../../_shared/editor-state";
import { partNames } from "../../../../entities/piece-parts";
import { apiStatusIs } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { normalizeSession, type LoreSession } from "./session";
import type { MarinaraFoldersApi } from "./use-marinara-folders";
import { readLoreLight } from "./light-read";
import { readMarinaraEdges } from "./folder-tree";

interface LoreDraft {
  body: LorebookBody;
  edges: ReadonlyMap<string, string | null>;
}

function sameEdges(a: ReadonlyMap<string, string | null>, b: ReadonlyMap<string, string | null>): boolean {
  return a.size === b.size && [...a].every(([id, parent]) => b.has(id) && b.get(id) === parent);
}

export function lorebookSaveAdapter(args: {
  ctx: AppContext;
  id: string;
  entity: unknown;
  baseline: LorebookBody;
  dirty: boolean;
  revision: { current: string };
  editRevision: { current: number };
  session: { current: LoreSession };
  folders: MarinaraFoldersApi;
  capturePatchState(body: LorebookBody, revision: number): { structural: boolean; items: Record<string, unknown>; release(): void; overwrite(): void };
  setBaseline(body: LorebookBody, revision: number): void;
  reseed(body: LorebookBody): void;
  setSession(session: LoreSession): void;
}): EditorSaveAdapter<LoreDraft, ParsedCanonicalEntity> {
  const { ctx, id, entity, baseline, dirty, revision, editRevision, session, folders } = args;
  return {
    hasChanges: () => dirty,
    capture: () => {
      const body = session.current.body;
      const edges = folders.captureEdges();
      const atRevision = editRevision.current;
      const patchState = args.capturePatchState(body, atRevision);
      const base = isRecord(entity) && entity.kind === "lorebook" && entity.id === id
        ? { ...entity, body: baseline } as ParsedCanonicalEntity
        : (() => { throw new Error("Lorebook save requires its accepted canonical head"); })();
      return { draft: { body, edges }, baseline: base, revision: atRevision, patchState };
    },
    expectedRevision: () => revision.current,
    read: async () => {
      const fresh = await readLoreLight(ctx, id);
      return { entity: fresh.entity as ParsedCanonicalEntity, revision: fresh.revision };
    },
    nativeState: (accepted) => isRecord(accepted) ? readMarinaraEdges(accepted.original) : new Map(),
    onAcceptedNative: (native) => { if (native instanceof Map) folders.markEdgesSaved(native); },
    buildPatch: (base, draft, native, state) => {
      const next = { ...base, body: draft.body } as ParsedCanonicalEntity;
      const patch = state && !state.structural ? buildTouchedPatch(next, state.items) : buildPiecePatch(base, next);
      if (native instanceof Map && !sameEdges(draft.edges, native)) {
        Object.assign(patch, { native: { marinaraFolderParents: [...draft.edges].map(([id, parentFolderId]) => ({ id, parentFolderId })) } });
      }
      return patch;
    },
    itemNames: partNames,
    applyPatch: applyPiecePatch,
    advanceNative: (native, patch) => {
      const parents = (patch as { native?: { marinaraFolderParents?: readonly { id: string; parentFolderId: string | null }[] } }).native?.marinaraFolderParents;
      return parents ? new Map(parents.map(({ id, parentFolderId }) => [id, parentFolderId])) : native;
    },
    patch: (expected, patch, intent) => ctx.api.patchEditedEntity("lorebook", id, expected, patch, undefined, intent),
    commit: (draft, atRevision, nextRevision) => {
      revision.current = nextRevision;
      args.setBaseline(draft.body, atRevision);
      folders.markEdgesSaved(draft.edges);
    },
    commitPartial: (saved, atRevision, nextRevision) => {
      revision.current = nextRevision;
      args.setBaseline(saved.body as LorebookBody, atRevision);
    },
    takeTheirs: (fresh, nextRevision) => {
      if (!isRecord(fresh)) return;
      const body = isRecord(fresh.body) ? fresh.body as unknown as LorebookBody : null;
      if (!body || typeof body.name !== "string" || !Array.isArray(body.entries)) return;
      revision.current = nextRevision;
      editRevision.current++;
      const edges = readMarinaraEdges(fresh.original);
      const next = normalizeSession(body, edges);
      args.reseed(next.body);
      args.setSession(next);
      folders.reseedEdges(edges, body.categories ?? []);
    },
    isConflict: (error) => apiStatusIs(error, 409),
    onSave: (draft, mode) => ctx.setStatus(`${mode === "keepMine" ? "overwrote" : "saved"} lorebook · ${draft.body.name}`),
    onError: (error, mode) => ctx.setStatus(toErrorMessage(error, mode === "takeTheirs" ? "could not reload the lorebook" : "save failed")),
  };
}
