/**
 * Studio WRITE routes (save, delete, restore), split from server.ts for the one-concept-per-file cap.
 * Both parse untrusted JSON once behind the shared caps and fold storage failures via studioErr.
 */
import type { CanonicalEntity } from "../core/canonical";
import { toErrorMessage } from "../error-message";
import type { StudioStoreLike } from "../studio/contracts";
import { parseStudioPatchRequest } from "./_shared/studio-patch-request";
import { err, json, readJsonObject, studioErr } from "./server-security";
import { handleCancelStaged, handleSaveStaged } from "./server-staging";
import { AssetStageError, consumeSessionUploads, openSessionUploads } from "./server-asset-staging";
import { isSha256Hex } from "../core/sha256";

type AnyEntity = CanonicalEntity<string, unknown>;

export async function handleStudioSave(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) return parsed.response;
    const raw = parsed.value as
      | AnyEntity
      | { entity?: AnyEntity; overwrite?: boolean; expectedRevision?: unknown };
    // Editor re-saves wrap { entity, overwrite: true }; import posts the entity bare (keep-both).
    const wrapped = "entity" in raw && raw.entity && typeof raw.entity === "object";
    const entity = (wrapped ? raw.entity : raw) as AnyEntity;
    const overwrite = wrapped ? raw.overwrite === true : false;
    if (typeof entity.kind !== "string") return err("expected a canonical entity");
    if (wrapped && "expectedRevision" in raw) {
      if (!isSha256Hex(raw.expectedRevision)) {
        return err("expected a valid revision");
      }
      const result = await store.compareAndSave(entity, raw.expectedRevision);
      if (result.status !== "saved") {
        return result.status === "stale"
          ? err("piece changed since it was opened", 409)
          : err("piece no longer exists", 404);
      }
      return json({ summary: result.summary, revision: result.revision });
    }
    return json(await store.save(entity, { overwrite }));
  } catch (e) {
    return studioErr(e);
  }
}

/** POST /api/studio/patch: only the content-store patch path may change editor fields. */
export async function handleStudioPatch(req: Request, store: StudioStoreLike, session = ""): Promise<Response> {
  try {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) return parsed.response;
    const envelope = parseStudioPatchRequest(parsed.value);
    if (!envelope.ok) return err(envelope.error);
    if (!store.comparePatch) return err("patch saves are unavailable", 501);
    const { kind, id, expectedRevision, patch, uploads: uploadRefs, intent } = envelope.value;
    const uploads = await openSessionUploads(uploadRefs, session, store);
    const result = await store.comparePatch(kind, id, expectedRevision, patch, uploads, intent);
    if (result.status !== "saved") return result.status === "stale" ? err("piece changed since it was opened", 409) : err("piece no longer exists", 404);
    await consumeSessionUploads(uploadRefs, session);
    return json({ summary: result.summary, revision: result.revision });
  } catch (error) {
    if (error instanceof AssetStageError) return err(error.message, error.status);
    return studioErr(error);
  }
}

/** POST /api/studio/duplicate: a keep-both copy made by reference, so a big pack never crosses the wire. */
export async function handleStudioDuplicate(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) return parsed.response;
    const { kind, id } = parsed.value;
    if (typeof kind !== "string" || typeof id !== "string") return err("expected { kind, id }");
    if (!store.duplicate) return err("duplicate is unavailable", 501);
    const copy = await store.duplicate(kind, id);
    return copy ? json(copy) : err("piece no longer exists", 404);
  } catch (e) {
    return studioErr(e);
  }
}

export async function handleStudioRestore(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) return parsed.response;
    const graveId = parsed.value.graveId;
    if (typeof graveId !== "string") return err("expected { graveId }");
    const back = await store.restore(graveId);
    return back ? json(back) : err("that piece is no longer in the Trash", 404);
  } catch (e) {
    return studioErr(e);
  }
}

/** Post-commit maintenance hint: planner failures never reverse or misreport a completed import. */
export async function handleStudioImportComplete(req: Request, store: StudioStoreLike, session = ""): Promise<Response> {
  if (!session) return err("authenticated local session required", 403);
  const parsed = await readJsonObject(req, 1024);
  if (!parsed.ok) return parsed.response;
  const count = parsed.value.pieceCount;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000) {
    return err("expected a bounded committed piece count");
  }
  try {
    await store.importCompleted?.(count);
  } catch (error) {
    console.warn("library: post-import planner refresh failed:", toErrorMessage(error));
  }
  return json({ ok: true });
}

/** The Studio's POST routes, by path. */
export const STUDIO_WRITES: Record<string, (req: Request, store: StudioStoreLike, session?: string) => Promise<Response>> = {
  "/api/studio/save": handleStudioSave,
  "/api/studio/patch": handleStudioPatch,
  "/api/studio/delete": handleStudioDelete,
  "/api/studio/duplicate": handleStudioDuplicate,
  "/api/studio/restore": handleStudioRestore,
  "/api/studio/save-staged": (req, store, session = "") => handleSaveStaged(req, store, session).catch(studioErr),
  "/api/studio/cancel-staged": (req, _store, session = "") => handleCancelStaged(req, session),
  "/api/studio/import-complete": handleStudioImportComplete,
};

export async function handleStudioDelete(req: Request, store: StudioStoreLike): Promise<Response> {
  try {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) return parsed.response;
    const raw = parsed.value;
    if (typeof raw.kind !== "string" || typeof raw.id !== "string") {
      return err("expected { kind, id }");
    }
    if (!store.deleteWithReceipt) return json({ deleted: await store.delete(raw.kind, raw.id) });
    const receipt = await store.deleteWithReceipt(raw.kind, raw.id);
    return json({ deleted: Boolean(receipt), receipt });
  } catch (e) {
    return studioErr(e);
  }
}
