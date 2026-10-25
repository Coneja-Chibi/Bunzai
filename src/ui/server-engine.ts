/**
 * UI server engine plumbing: inspect/export over the same adapters as the CLI.
 * Extracted from server.ts (behavior-preserving).
 */
import { isLibraryLocked } from "../studio/errors";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildParseReport, primaryOriginalId } from "../core";
import { isArchiveLimitError } from "../core/archive";
import { isArchiveFormatError } from "../core/archive-stream";
import {
  importLumiverseArchive,
  LVBAK_ARCHIVE_BOUNDS,
  LVBAK_SCHEMA_VERSION,
  LvbakSchemaError,
} from "../formats/lumiverse-archive";
import { zipEntrySourceFromFile } from "../formats/lumiverse-archive/zip-source";
import { cancelStagedRows, stageArchiveEntities, stageInspectedEntity } from "./server-staging";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import type { StudioStoreLike } from "../studio/contracts";
import type { InspectArchiveResult, InspectResult } from "./app-contract";
import { buildReceipt } from "./receipt";
import { EngineActionError, exportCanonical, formatMeta, inspectBytes } from "./engine-actions";
import {
  contentTypeIs,
  err,
  json,
  readBodyCapped,
  streamBodyToFile,
  INSPECT_BODY_MAX,
} from "./server-security";
import { presentStrArray } from "../core/guards";

export { formatMeta } from "./engine-actions";

const STAGE_INSPECT_BYTES = 8 * 1024 * 1024;

export async function handleInspect(req: Request, session: string, allowStaging = true): Promise<Response> {
  if (!contentTypeIs(req, "application/octet-stream")) return err("unsupported media type", 415);
  const rawFilename = req.headers.get("x-filename") ?? "upload";
  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    filename = rawFilename;
  }
  const capped = await readBodyCapped(req, INSPECT_BODY_MAX);
  if (!capped.ok) return capped.response;
  try {
    const result = inspectBytes(capped.bytes, filename);
    if (!result.ok || !result.entity) return json(result);
    const payload = JSON.stringify({ entity: result.entity, ...(result.related ? { related: result.related } : {}) });
    if (Buffer.byteLength(payload) <= STAGE_INSPECT_BYTES) return json(result);
    if (!allowStaging) return err("large imports are available in the local studio only", 413);
    const ref = await stageInspectedEntity(
      result.entity as ParsedCanonicalEntity,
      result.related,
      session,
      req.signal,
      result.related ? undefined : payload,
    );
    (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc?.(true); // the inspected copies are dead: do not let them ride into the save
    if (req.signal.aborted) {
      await cancelStagedRows([ref], session);
      return err("import was cancelled", 499);
    }
    const body = result.entity as { body?: { entries?: unknown; knowledgeRefs?: unknown } };
    const staged: InspectResult = {
      ...result,
      entity: undefined,
      related: undefined,
      staged: { token: ref.token, key: ref.key },
      entityId: ref.entityId,
      contentHash: ref.contentHash,
      ...(Array.isArray(body.body?.knowledgeRefs) ? { knowledgeRefs: body.body.knowledgeRefs.filter((item): item is string => typeof item === "string") } : {}),
      ...(result.kind === "lorebook" && Array.isArray(body.body?.entries) ? { entryCount: body.body.entries.length } : {}),
    };
    return json(staged);
  } catch (error) {
    if (isLibraryLocked(error)) throw error; // answered as 423 by the server's front door
    if (error instanceof Error && "status" in error && typeof error.status === "number") return err(error.message, error.status);
    return error instanceof EngineActionError
      ? err(error.message, error.status)
      : err("could not inspect file", 500);
  }
}
// One archive inspect at a time, server-side. Each request can stage up to
// LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes (8 GiB) of temp file - the same disk-fill concern that
// already makes this route loopback-only (server.ts's isLoopbackOnlyRoute) applies just as much to
// the surface that DOES accept it. Safe as a bare module-level flag: Bun's single-threaded event
// loop means the check-then-set below never races across two concurrent requests. The client's own
// ARCHIVE_POOL=1 (import-flow.tsx) already serializes uploads from one sheet, so this changes
// nothing for the normal path - it only refuses a genuinely overlapping second request.
let archiveInspectInFlight = false;
const failedArchiveCleanup = new Set<string>();

async function retryArchiveCleanup(): Promise<void> {
  for (const path of [...failedArchiveCleanup]) {
    try {
      await rm(path, { recursive: true, force: true });
      failedArchiveCleanup.delete(path);
    } catch { /* one retained slot blocks the next archive import */ }
  }
}

/**
 * Handle a `.lvbak` upload (spec:). Deliberately its OWN route,
 * never `/api/inspect`: that endpoint buffers the whole body into one Uint8Array and caps it at
 * ADAPTER_INPUT_MAX_BYTES (64 MiB) - fine for a single card, hopeless for a Lumiverse backup, which
 * is multi-gigabyte by design and whose real ceiling is LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes (8
 * GiB). The upload streams straight to a throwaway OS-temp file (never held in memory at once,
 * same discipline the fixture materializer already uses for the same format), and
 * zipEntrySourceFromFile reads it back with bounded random access. The temp file is removed
 * whether the import succeeds or fails - it has no purpose past this one request.
 *
 * `.lvbak` registers no adapter on purpose (index.ts's own barrel comment), so this never touches
 * registry.detect: the detection race that decides every OTHER upload's format must never see an
 * archive, or a hostile .lvbak could get mis-claimed by some other adapter's sniffing.
 */
export async function handleInspectArchive(req: Request, session: string): Promise<Response> {
  if (!contentTypeIs(req, "application/octet-stream")) {
    return err("unsupported media type", 415);
  }
  const rawFilename = req.headers.get("x-filename") ?? "upload.lvbak";
  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    filename = rawFilename;
  }
  if (!filename.toLowerCase().endsWith(".lvbak")) {
    return err("expected a .lvbak file", 400);
  }
  if (archiveInspectInFlight) {
    return err("Another backup is still being read - try again when it finishes.", 429);
  }
  archiveInspectInFlight = true;

  let dir = "";
  let tempPath = "";
  let source: Awaited<ReturnType<typeof zipEntrySourceFromFile>> | undefined;
  try {
    await retryArchiveCleanup();
    if (failedArchiveCleanup.size > 0) return err("A previous backup upload is still being cleaned up.", 503);
    dir = await mkdtemp(join(tmpdir(), "bunraku-lvbak-upload-"));
    tempPath = join(dir, "upload.lvbak");
    const staged = await streamBodyToFile(req, tempPath, LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes);
    if (!staged.ok) return staged.response;
    if (staged.bytes === 0) return err("empty upload");

    source = zipEntrySourceFromFile(tempPath, LVBAK_ARCHIVE_BOUNDS);
    const { entities, report } = await importLumiverseArchive(source);
    // Rows are SUMMARIES: the entities go to disk-side staging, never into this response. A real
    // backup's entities total gigabytes; embedding them is exactly what OOM'd the old design
    // (JSON.stringify caps near 2 GiB). Commit fetches each row back via /api/studio/save-staged.
    const stagedRefs = await stageArchiveEntities(entities, session, req.signal);
    if (req.signal.aborted) {
      await cancelStagedRows(stagedRefs, session);
      return err("import was cancelled", 499);
    }
    const rows: InspectResult[] = entities.map((entity, i) => {
      const sourceId = primaryOriginalId(entity.original) ?? "lumiverse-archive";
      const ref = stagedRefs[i]!;
      // The sheet's link caveat and entry-count chip used to read these off the entity; summary
      // rows must carry them explicitly or those features go silently dead on archive rows.
      const body = entity.body as { knowledgeRefs?: unknown; entries?: unknown };
      const knowledgeRefs = presentStrArray(body.knowledgeRefs);
      const entryCount =
        entity.kind === "lorebook" && Array.isArray(body.entries) ? body.entries.length : undefined;
      return {
        ok: true,
        receipt: buildReceipt(entity, "lumiverse-archive"),
        staged: { token: ref.token, key: ref.key },
        entityId: ref.entityId,
        contentHash: ref.contentHash,
        ...(knowledgeRefs && knowledgeRefs.length > 0 ? { knowledgeRefs } : {}),
        ...(entryCount !== undefined ? { entryCount } : {}),
        formatId: "lumiverse-archive",
        kind: entity.kind,
        parseReport: buildParseReport(entity, sourceId),
      };
    });
    const result: InspectArchiveResult = { ok: true, rows, report };
    return json(result);
  } catch (error) {
    if (isLibraryLocked(error)) throw error; // answered as 423 by the server's front door
    const result: InspectArchiveResult = { ok: false, error: archiveErrorMessage(error) };
    return json(result, 200);
  } finally {
    try { await source?.close(); } catch { /* the bounded directory owner retries the removal */ }
    if (dir) {
      try { await rm(dir, { recursive: true, force: true }); }
      catch {
        if (!failedArchiveCleanup.has(dir)) {
          failedArchiveCleanup.add(dir);
        }
      }
    }
    archiveInspectInFlight = false;
  }
}

/** Warm, plain-words line for a whole-archive abort - never the technical exception text. */
export function archiveErrorMessage(error: unknown): string {
  if (error instanceof LvbakSchemaError) {
    return (
      `This backup was made by a newer version of Lumiverse (schema ${error.schemaVersion}) than ` +
      `this build of Bunraku understands (schema ${LVBAK_SCHEMA_VERSION}). Update Bunraku and try again.`
    );
  }
  if (isArchiveLimitError(error)) {
    return "This archive is larger or more complex than Bunraku can safely read right now.";
  }
  if (isArchiveFormatError(error)) {
    return "This archive's container looks damaged or is not a valid ZIP; we could not read it safely.";
  }
  // The importer prefixes every deliberate rejection with "lumiverse-archive:" (no manifest, no
  // database/ tree, an unreadable required entry) - for those, "not a backup" is the truth.
  if (error instanceof Error && error.message.startsWith("lumiverse-archive:")) {
    return "We could not read this one. It does not look like a Lumiverse backup archive (.lvbak).";
  }
  // Anything else is OUR failure, not the backup's. Blaming the file here sent a real user
  // chasing a corrupt-backup theory when the actual fault was a response-size crash server-side.
  console.error("[inspect-archive] unexpected failure:", error);
  return "Something went wrong on Bunraku's side while reading this backup. The details were logged; the backup itself is probably fine.";
}

export async function handleExport(store: StudioStoreLike, body: unknown): Promise<Response> {
  try {
    return json(await exportCanonical(store, body));
  } catch (error) {
    if (isLibraryLocked(error)) throw error; // answered as 423 by the server's front door
    return error instanceof EngineActionError
      ? err(error.message, error.status)
      : err("could not export entity", 500);
  }
}
