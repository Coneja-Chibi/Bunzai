/** Session-bound encrypted staging shared by archive and large single-file imports. */
import { createHash, randomBytes } from "node:crypto";
import { isRecord } from "../core/guards";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../entities/runtime-schema";
import type { BundleSaveInput } from "../studio/bundle";
import { isImportedScene, type ImportedScene } from "../core/scene-import";
import { saveSceneCarrier } from "./server-scene-save";
import { aesOpen, aesSeal, type AesParts } from "../kit/keystore/aes";
import { saveBundle } from "../studio/bundle";
import type { StudioStoreLike } from "../studio/contracts";
import { rewriteKnowledgeRefsFor } from "./_shared/knowledge-refs";
import { clearStagedAssets } from "./server-asset-staging";
import type { SaveStagedPayload } from "./app-contract";
import { err, json, readJsonObject } from "./server-security";

interface StagedPayload {
  entity: ParsedCanonicalEntity | ImportedScene;
  related?: Pick<BundleSaveInput, "lorebooks" | "regexSets">;
}

interface StagedFile { path: string; bytes: number; committing: boolean; }
interface LiveStaging {
  dir: string;
  session: string;
  expires: number;
  bytes: number;
  files: Map<string, StagedFile>;
  orphaned: Map<string, number>;
}

const stagings = new Map<string, LiveStaging>();
const active = new Map<symbol, AbortController>();
const failedCleanup = new Map<string, number>();
const MAX_STAGINGS = 8;
const MAX_ROWS_PER_STAGING = 10_000;
const MAX_STAGED_BYTES = 8 * 1024 ** 3;
const TTL_MS = 30 * 60 * 1000;
const CLEANUP_LIMIT = 32;
const STAGING_KEY = randomBytes(32);
let stagedBytes = 0;
let reservedBytes = 0;
let cleanupBytes = 0;

export interface StagedRowRef {
  token: string;
  key: string;
  entityId: string;
  contentHash: string;
}

class StagingError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StagingError(499, "import was cancelled");
}

async function removePath(path: string, bytes: number): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
    const held = failedCleanup.get(path);
    if (held !== undefined) cleanupBytes -= held;
    failedCleanup.delete(path);
  } catch {
    if (!failedCleanup.has(path)) {
      failedCleanup.set(path, bytes);
      cleanupBytes += bytes;
    }
  }
}

async function retryCleanup(): Promise<void> {
  for (const [token, staging] of stagings) {
    for (const [path, bytes] of staging.orphaned) {
      try {
        await rm(path, { force: true });
        staging.orphaned.delete(path);
        staging.bytes -= bytes;
        stagedBytes -= bytes;
      } catch { /* still bounded by this live staging's byte reservation */ }
    }
    if (staging.files.size === 0 && staging.orphaned.size === 0) {
      stagings.delete(token);
      await removePath(staging.dir, 0);
    }
  }
  for (const [path, bytes] of [...failedCleanup]) await removePath(path, bytes);
}

async function unlinkStagedFile(staging: LiveStaging, file: StagedFile): Promise<void> {
  try {
    await rm(file.path, { force: true });
  } catch {
    staging.orphaned.set(file.path, file.bytes);
    staging.bytes += file.bytes;
    stagedBytes += file.bytes;
  }
}

async function discard(staging: LiveStaging): Promise<void> {
  for (const [path, bytes] of [...failedCleanup]) {
    if (path.startsWith(`${staging.dir}/`) || path.startsWith(`${staging.dir}\\`)) {
      failedCleanup.delete(path);
      cleanupBytes -= bytes;
      staging.bytes += bytes;
    }
  }
  stagedBytes -= staging.bytes;
  await removePath(staging.dir, staging.bytes);
}

async function pruneExpired(now = Date.now()): Promise<void> {
  for (const [token, staging] of stagings) {
    if (staging.expires > now || [...staging.files.values()].some((file) => file.committing)) continue;
    stagings.delete(token);
    await discard(staging);
  }
  await retryCleanup();
}

const expiryTimer = setInterval(() => { void pruneExpired(); }, 60_000); // interval-ok: server import expiry runs independently of tab visibility
expiryTimer.unref?.();

async function stagePayloads(payloads: readonly StagedPayload[], session: string, signal?: AbortSignal, texts?: readonly string[]): Promise<StagedRowRef[]> {
  if (!session) throw new StagingError(403, "authenticated session required");
  if (payloads.length === 0) return [];
  if (payloads.length > MAX_ROWS_PER_STAGING) throw new StagingError(413, "too many imported rows");
  const reservation = Symbol();
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  active.set(reservation, controller); // reserve before the first await: concurrent inspections cannot over-admit.
  let dir = "";
  let dirBytes = 0;
  const files = new Map<string, StagedFile>();
  try {
    await pruneExpired();
    await retryCleanup();
    if (stagings.size + active.size > MAX_STAGINGS) throw new StagingError(503, "import staging is at capacity");
    if (failedCleanup.size + active.size >= CLEANUP_LIMIT) throw new StagingError(503, "staging cleanup is at capacity");
    checkAbort(controller.signal);
    dir = await mkdtemp(join(tmpdir(), "bunraku-import-staged-"));
    const token = randomBytes(24).toString("base64url");
    const refs: StagedRowRef[] = [];
    for (let i = 0; i < payloads.length; i += 1) {
      checkAbort(controller.signal);
      if (failedCleanup.size + active.size >= CLEANUP_LIMIT) throw new StagingError(503, "staging cleanup is at capacity");
      const payload = payloads[i]!;
      const text = texts?.[i] ?? JSON.stringify(payload);
      const key = `row-${i}`;
      const sealed = JSON.stringify(aesSeal(STAGING_KEY, text, `${token}:${key}`));
      const bytes = Buffer.byteLength(sealed);
      if (stagedBytes + reservedBytes + cleanupBytes + bytes > MAX_STAGED_BYTES) {
        throw new StagingError(413, "encrypted import staging budget exceeded");
      }
      reservedBytes += bytes;
      const path = join(dir, `${key}.sealed`);
      try {
        await writeFile(path, sealed, { mode: 0o600 });
      } catch (error) {
        const partialBytes = await stat(path).then((file) => file.size, () => bytes);
        dirBytes += partialBytes;
        stagedBytes += partialBytes;
        throw error;
      } finally {
        reservedBytes -= bytes;
      }
      dirBytes += bytes;
      stagedBytes += bytes;
      files.set(key, { path, bytes, committing: false });
      refs.push({
        token,
        key,
        entityId: payload.entity.id,
        contentHash: createHash("sha256").update(text).digest("hex"),
      });
    }
    checkAbort(controller.signal);
    stagings.set(token, { dir, session, expires: Date.now() + TTL_MS, bytes: dirBytes, files, orphaned: new Map() });
    return refs;
  } catch (error) {
    if (dir) {
      stagedBytes -= dirBytes;
      await removePath(dir, dirBytes);
    }
    throw error;
  } finally {
    active.delete(reservation);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Stage `.lvbak` rows without changing the archive importer or its saveBundle commit path. */
export function stageArchiveEntities(entities: readonly ParsedCanonicalEntity[], session: string, signal?: AbortSignal): Promise<StagedRowRef[]> {
  return stagePayloads(entities.map((entity) => ({ entity })), session, signal);
}

/** Stage a large inspect group (primary plus related rows) before its JSON reaches the browser. */
export function stageInspectedEntity(
  entity: ParsedCanonicalEntity | ImportedScene,
  related: { lorebooks?: unknown[]; regexSets?: unknown[] } | undefined,
  session: string,
  signal?: AbortSignal,
  /** The payload's JSON when the caller already made it (`{entity}` with no related pieces): a big pack is not serialized twice. */
  entityText?: string,
): Promise<StagedRowRef> {
  const parsedRelated = related ? {
    lorebooks: related.lorebooks?.map((raw) => {
      const parsed = parseCanonicalEntity(raw);
      if (parsed.kind !== "lorebook") throw new StagingError(422, "expected a related lorebook");
      return parsed;
    }),
    regexSets: related.regexSets?.map((raw) => {
      const parsed = parseCanonicalEntity(raw);
      if (parsed.kind !== "regex") throw new StagingError(422, "expected a related regex set");
      return parsed;
    }),
  } : undefined;
  return stagePayloads([{ entity, ...(parsedRelated ? { related: parsedRelated } : {}) }], session, signal, entityText !== undefined && !parsedRelated ? [entityText] : undefined).then((rows) => rows[0]!);
}

async function removeCommittedRow(staging: LiveStaging, key: string, file: StagedFile): Promise<void> {
  if (staging.files.get(key) !== file) return;
  staging.files.delete(key);
  staging.bytes -= file.bytes;
  stagedBytes -= file.bytes;
  await unlinkStagedFile(staging, file);
  if (staging.files.size === 0 && staging.orphaned.size === 0) {
    stagings.delete([...stagings].find(([, value]) => value === staging)?.[0] ?? "");
    await removePath(staging.dir, 0);
  }
}

/** Revoke refs created by a cancelled import. A stale ref never names a path. */
export async function cancelStagedRows(rows: readonly { token: string; key: string }[], session: string): Promise<number> {
  const grouped = new Map<LiveStaging, StagedFile[]>();
  let removed = 0;
  for (const row of rows) {
    const staging = stagings.get(row.token);
    if (!staging || staging.session !== session) continue;
    const file = staging.files.get(row.key);
    if (!file || file.committing) continue;
    // Claim cancellation synchronously. A commit can only win before this point; after the map
    // entry is removed no request can begin reading this row, even while disk cleanup awaits.
    file.committing = true;
    staging.files.delete(row.key);
    staging.bytes -= file.bytes;
    stagedBytes -= file.bytes;
    const files = grouped.get(staging) ?? [];
    files.push(file);
    grouped.set(staging, files);
    removed++;
  }
  for (const [staging, files] of grouped) {
    for (const file of files) {
      await unlinkStagedFile(staging, file);
    }
    if (staging.files.size === 0 && staging.orphaned.size === 0) {
      const token = [...stagings].find(([, value]) => value === staging)?.[0];
      if (token) stagings.delete(token);
      await removePath(staging.dir, 0);
    }
  }
  return removed;
}

/** Lock, shutdown, and explicit cancel revoke all staged rows and upload refs. */
export async function clearAllStagings(): Promise<void> {
  for (const controller of active.values()) controller.abort();
  const doomed = [...stagings.values()];
  stagings.clear();
  for (const staging of doomed) await discard(staging);
  await clearStagedAssets();
  await retryCleanup();
}

const STALE_STAGING = "That import's rows are no longer staged - inspect the file again.";

/** Commit a single archive or inspect group by reference, always through saveBundle. */
export async function handleSaveStaged(req: Request, store: StudioStoreLike, session: string): Promise<Response> {
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.value as Partial<SaveStagedPayload>;
  if (typeof raw.token !== "string" || typeof raw.key !== "string") return err("expected { token, key, refIds? }");
  let refEntries: [string, string][] | undefined;
  if (Object.hasOwn(raw, "refIds")) {
    if (!isRecord(raw.refIds)) return err("expected refIds to be an object");
    const entries = Object.entries(raw.refIds);
    if (entries.length > MAX_ROWS_PER_STAGING || entries.some(([from, to]) => !from || from.length > 256 || typeof to !== "string" || !to || to.length > 256)) {
      return err("invalid or oversized refIds map");
    }
    refEntries = entries as [string, string][];
  }
  const staging = stagings.get(raw.token);
  if (!staging || staging.session !== session || staging.expires <= Date.now()) return err(STALE_STAGING, 409);
  const file = staging.files.get(raw.key);
  if (!file) return err("unknown staged row", 404);
  if (file.committing) return err("staged row is already being saved", 409);
  file.committing = true;
  try {
    let payload = JSON.parse(aesOpen(STAGING_KEY, JSON.parse(await readFile(file.path, "utf8")) as AesParts, `${raw.token}:${raw.key}`)) as StagedPayload;
    if (refEntries && !isImportedScene(payload.entity)) {
      const idMap = new Map(refEntries);
      payload = { ...payload, entity: parseCanonicalEntity(rewriteKnowledgeRefsFor(payload.entity, idMap)) };
    }
    const result = isImportedScene(payload.entity)
      ? await saveSceneCarrier(store, payload.entity)
      : await saveBundle(store, {
        entity: payload.entity,
        ...(payload.related ? { lorebooks: payload.related.lorebooks, regexSets: payload.related.regexSets } : {}),
      });
    if (result.ok) await removeCommittedRow(staging, raw.key, file);
    return json(result, result.ok ? 200 : result.partial ? 207 : 422);
  } finally {
    if (staging.files.get(raw.key) === file) file.committing = false;
    // A big import's sealed text, parsed entity and sealed parts are all dead now; collect before the next request.
    if (file.bytes > 8 * 1024 * 1024) (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc?.(true);
  }
}

/** POST /api/studio/cancel-staged: only refs belonging to this authenticated page session revoke. */
export async function handleCancelStaged(req: Request, session: string): Promise<Response> {
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const rows = parsed.value.rows;
  if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_STAGING || rows.some((row) =>
    !isRecord(row) || typeof row.token !== "string" || typeof row.key !== "string")) return err("expected staged row refs");
  return json({ removed: await cancelStagedRows(rows as { token: string; key: string }[], session) });
}
