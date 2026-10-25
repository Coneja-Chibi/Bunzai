/** Authenticated opaque asset responses and pinned portrait-reference metadata. */
import type { StudioStoreLike } from "../studio/contracts";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { KeyLease } from "../stage/crypto/keyring-lifecycle";
import { assetBytesResponse } from "./_shared/asset-content";
import { err, json, studioErr } from "./server-security";
import { ASSET_ROUTE_PREFIX, assetRouteSha } from "../core/media/asset-route";
import { isSha256Hex } from "../core/sha256";
import { ASSET_MAX_BYTES } from "../core/media/limits";
import { parseRange } from "./_shared/asset-range";

const portraitContentResponse = (content: { bytes: Uint8Array; sha: string } | null, head = false): Response =>
  content ? assetBytesResponse(content.bytes, content.sha, head) ?? err("unsupported portrait bytes", 415) : err("portrait not found", 404);

/** Hold copied keys across a complete read and reject any result after a key drop or library reopen. */
export async function withLibraryReadLease(access: { leaseKeys(): KeyLease }, current: () => boolean, read: () => Promise<Response>): Promise<Response> {
  let lease: KeyLease | null = null;
  try {
    lease = access.leaseKeys();
    if (!lease.valid()) return err("library locked during asset read", 423);
    const response = await read();
    return lease.valid() && current() ? response : err("library locked during asset read", 423);
  } catch (error) { return studioErr(error); }
  finally { lease?.release(); }
}

/** Binary compatibility endpoint backed by a targeted portrait read, never a full entity read. */
export async function handleLegacyPortraitRoute(path: string, url: URL, store: StudioStoreLike, method: string): Promise<Response | null> {
  if (path !== "/api/studio/portrait") return null;
  if (method !== "GET" && method !== "HEAD") return err("portrait method is not supported", 405);
  const kind = url.searchParams.get("kind") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!kind || !id) return err("portrait not found", 404);
  if (!store.readPortraitAsset) return err("portrait storage is unavailable", 404);
  const revisions = url.searchParams.getAll("r");
  const writes = url.searchParams.getAll("w");
  if (revisions.length > 1 || writes.length > 1 || (revisions[0] !== undefined && !isSha256Hex(revisions[0])) || (writes[0] !== undefined && (!/^\d+$/.test(writes[0]) || !Number.isSafeInteger(Number(writes[0]))))) return err("invalid portrait receipt", 400);
  try {
    const reference = await store.readPortraitAsset(kind, id);
    if (!reference) return err("portrait not found", 404);
    if ((revisions[0] !== undefined && reference.revision !== revisions[0]) || (writes[0] !== undefined && reference.writeId !== Number(writes[0]))) return err("portrait changed", 409);
    if (method === "HEAD") {
      const size = "sha" in reference.asset ? await store.assetSize?.(reference.asset.sha) : { status: "ok", bytes: reference.asset.bytes };
      if (!size || size.status !== "ok" || !Number.isSafeInteger(size.bytes)) return err("portrait size is unavailable", 422);
      const latest = await store.readPortraitAsset(kind, id);
      if (!latest || latest.writeId !== reference.writeId || latest.revision !== reference.revision || latest.version !== reference.version) return err("portrait changed", 409);
      return new Response(null, { headers: { "content-length": String(size.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    }
    if (!store.readPortraitContent) return err("portrait storage is unavailable", 404);
    const content = await store.readPortraitContent(kind, id);
    const latest = await store.readPortraitAsset(kind, id);
    if (!latest || latest.writeId !== reference.writeId || latest.revision !== reference.revision || latest.version !== reference.version) return err("portrait changed", 409);
    if (content && (content.writeId !== reference.writeId || content.revision !== reference.revision || content.version !== reference.version)) return err("portrait changed", 409);
    return portraitContentResponse(content);
  }
  catch (error) { return studioErr(error); }
}

/**
 * A grid of big pictures opens dozens of blobs in a burst; each read leaves several transient copies (sealed
 * text, plaintext, bytes) that the collector would otherwise let pile up to hundreds of megabytes before it
 * runs. After every few megabytes served, ask for a collection so the burst's peak stays near one picture's
 * worth. Cheap (a sweep of a small heap) and a no-op outside Bun.
 */
const BULK_BYTES = 16 * 1024 * 1024;
let servedSinceCollect = 0;
function releaseAfterBulk(bytes: number): void {
  servedSinceCollect += bytes;
  if (servedSinceCollect < BULK_BYTES) return;
  servedSinceCollect = 0;
  (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc?.(true);
}

const STAND_IN_MAX_BYTES = 8 * 1024 * 1024;
async function smallAssetStandIn(sha: string, store: StudioStoreLike, method: string): Promise<Response | null> {
  try {
    if (!store.readAsset || !store.assetSize) return null;
    const size = await store.assetSize(sha);
    if (size.status !== "ok" || size.bytes > STAND_IN_MAX_BYTES) return null;
    const opened = await store.readAsset(sha, STAND_IN_MAX_BYTES);
    if (opened.status !== "ok") return null;
    return assetBytesResponse(opened.bytes, sha, method === "HEAD");
  } catch {
    return null;
  }
}

/** Hash-addressed reads open one verified blob and never accept a caller-selected response MIME. */
export async function handleAssetRoute(path: string, url: URL, store: StudioStoreLike, method = "GET", range?: string | null): Promise<Response | null> {
  const sha = assetRouteSha(path);
  if (!sha) return path.startsWith(ASSET_ROUTE_PREFIX) ? err("invalid asset path", 404) : null;
  const size = url.searchParams.get("size") ?? "full";
  if (url.searchParams.getAll("size").length > 1 || !["full", "96", "256", "512"].includes(size)) return err("invalid asset size", 400);
  if (url.searchParams.has("mime")) return err("asset MIME is derived from verified bytes", 400);
  if (method !== "GET" && method !== "HEAD") return err("asset method is not supported", 405);
  if (size !== "full") {
    if (!store.readThumbnail) return err("thumbnails are unavailable", 501);
    try {
      const bytes = await store.readThumbnail(sha, Number(size) as 96 | 256 | 512);
      return assetBytesResponse(bytes, sha, method === "HEAD", size) ?? err("invalid thumbnail bytes", 415);
    } catch (error) {
      // No thumbnail codec in this runtime (or an image it cannot decode): a small picture stands in for its own
      // thumbnail, so a card still shows its cover. Heavy pictures are refused rather than sent as a "thumbnail".
      const standIn = await smallAssetStandIn(sha, store, method);
      return standIn ?? studioErr(error);
    }
  }
  if (method === "HEAD") {
    if (!store.assetSize) return err("asset storage is unavailable", 404);
    try {
      const size = await store.assetSize(sha);
      if (size.status === "missing") return err("asset not found", 404);
      return new Response(null, { headers: { "content-length": String(size.bytes), "accept-ranges": "bytes", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    } catch (error) {
      return studioErr(error);
    }
  }
  if (!store.readAsset) return err("asset storage is unavailable", 404);
  try {
    // A byte range that starts past the end is answered from the stored size alone: nothing is read for it.
    let wanted = parseRange(range, 0);
    if (range && store.assetSize) {
      const known = await store.assetSize(sha);
      if (known.status === "missing") return err("asset not found", 404);
      wanted = parseRange(range, known.bytes);
      if (wanted.kind === "unsatisfiable") return new Response(null, { status: 416, headers: { "content-range": `bytes */${String(known.bytes)}`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    }
    const opened = await store.readAsset(sha, ASSET_MAX_BYTES);
    if (opened.status === "missing") return err("asset not found", 404);
    if (opened.status === "too-large") return err("asset exceeds the full-response byte limit", 413);
    if (opened.status !== "ok") return err("asset not found", 404);
    releaseAfterBulk(opened.bytes.byteLength);
    // The stored blob is one sealed cell, so a range is cut from the bounded read above (<= 32 MiB), not read from disk piecewise.
    const slice = wanted.kind === "partial" && wanted.end < opened.bytes.byteLength ? { start: wanted.start, end: wanted.end } : undefined;
    return assetBytesResponse(opened.bytes, sha, false, "full", slice) ?? err("asset bytes do not match a supported binary media type", 415);
  } catch (error) {
    return studioErr(error);
  }
}

/** Small metadata envelope; legacy inline carriers retain the old binary endpoint as a typed URL. */
export async function handlePortraitReferenceRoute(path: string, url: URL, store: StudioStoreLike, method = "GET"): Promise<Response | null> {
  if (path !== "/api/studio/portrait-ref") return null;
  if (method !== "GET" && method !== "HEAD") return err("portrait method is not supported", 405);
  const kind = url.searchParams.get("kind") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!kind || !id) return json(null, 400);
  if (!store.readPortraitAsset) return json(null, 404);
  try {
    const stored = await store.readPortraitAsset(kind, id);
    if (!stored) return json(null, 404);
    const asset = "sha" in stored.asset
      ? { sha: isSha256Hex(stored.asset.sha) ? stored.asset.sha : "" }
      : { url: stored.asset.url, ...(stored.asset.bytes === undefined ? {} : { bytes: stored.asset.bytes }) };
    if (("sha" in asset && !asset.sha) || ("url" in asset && !asset.url.startsWith("/api/studio/portrait?"))) return json(null, 404);
    if ("url" in asset) {
      const pinned = new URL(asset.url, "http://localhost");
      pinned.searchParams.set("r", stored.revision);
      pinned.searchParams.set("w", String(stored.writeId));
      asset.url = `${pinned.pathname}${pinned.search}`;
    }
    const result = { asset, revision: stored.revision, version: stored.version, writeId: stored.writeId };
    return method === "HEAD" ? new Response(null, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }) : json(result);
  } catch (error) {
    return studioErr(error);
  }
}

/** Frozen art uses snapshot metadata and immutable blobs; only migrated development scenes follow the live card. */
export async function handleFrozenPortraitRoute(request: Request, url: URL, chats: Pick<ChatStore, "castPortraitRef" | "getChat">, store: StudioStoreLike): Promise<Response | null> {
  const metadata = url.pathname === "/api/chats/portrait-ref";
  if (!metadata && url.pathname !== "/api/chats/portrait") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return err("portrait method is not supported", 405);
  const id = url.searchParams.get("id") ?? "";
  const expected = url.searchParams.get("v");
  const revision = url.searchParams.get("r");
  const writeId = url.searchParams.get("w");
  if (url.searchParams.getAll("w").length > 1 || (writeId !== null && (!/^\d+$/.test(writeId) || !Number.isSafeInteger(Number(writeId))))) return err("invalid portrait receipt", 400);
  if (!id || url.searchParams.getAll("v").length > 1 || (expected !== null && (!/^\d+$/.test(expected) || !Number.isSafeInteger(Number(expected))))) return err("invalid frozen portrait selector", 400);
  if (url.searchParams.getAll("r").length > 1 || (revision !== null && !isSha256Hex(revision))) return err("invalid portrait revision", 400);
  for (let attempt = 0; attempt < 3; attempt++) {
    const frozen = await chats.castPortraitRef(id);
    if (!frozen) return err("portrait not found", 404);
    if (expected !== null && Number(expected) !== frozen.snapshotVersion) return err("scene portrait changed", 409);
    const chat = frozen.liveCardFallback ? await chats.getChat(id) : null;
    if (frozen.liveCardFallback && (!chat || chat.snapshotVersion !== frozen.snapshotVersion)) continue;
    const live = chat && store.readPortraitAsset ? await store.readPortraitAsset("character", chat.cast.character.id) : null;
    if (chat && ((revision !== null && live?.revision !== revision) || (writeId !== null && live?.writeId !== Number(writeId)))) return err("scene portrait changed", 409);
    const asset = frozen.liveCardFallback ? live?.asset : frozen.ref;
    let response: Response;
    if (metadata) {
      const pinned = asset && "url" in asset && live ? {
        ...asset, url: `/api/chats/portrait?${new URLSearchParams({ id, v: String(frozen.snapshotVersion), r: live.revision, w: String(live.writeId) })}`,
      } : asset;
      response = request.method === "HEAD"
        ? new Response(null, { status: pinned ? 200 : 404, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } })
        : json(pinned ? { asset: pinned, snapshotVersion: frozen.snapshotVersion, ...(live ? { revision: live.revision, version: live.version, writeId: live.writeId } : {}) } : null, pinned ? 200 : 404);
    }
    else if (asset && "sha" in asset) {
      if (request.method === "HEAD") {
        const size = await store.assetSize?.(asset.sha);
        response = size?.status === "ok" ? new Response(null, { headers: {
          "content-length": String(size.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff",
        } }) : err("portrait not found", 404);
      } else {
        const opened = await store.readAsset?.(asset.sha, ASSET_MAX_BYTES);
        response = opened?.status === "too-large"
          ? err("portrait exceeds the bounded full-response byte limit", 413)
          : portraitContentResponse(opened?.status === "ok" ? { bytes: opened.bytes, sha: asset.sha } : null);
      }
    } else if (asset && "url" in asset && request.method === "HEAD" && Number.isSafeInteger(asset.bytes)) {
      response = new Response(null, { headers: {
        "content-length": String(asset.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff",
      } });
    } else if (chat && store.readPortraitContent && request.method === "GET") {
      response = portraitContentResponse(await store.readPortraitContent("character", chat.cast.character.id));
    } else response = err("portrait not found", 404);
    if (chat && store.readPortraitAsset) {
      const latest = await store.readPortraitAsset("character", chat.cast.character.id);
      if (latest?.writeId !== live?.writeId || latest?.revision !== live?.revision || latest?.version !== live?.version) continue;
    }
    const current = await chats.castPortraitRef(id);
    if (!current || current.snapshotVersion !== frozen.snapshotVersion) continue;
    response.headers.set("x-snapshot-version", String(frozen.snapshotVersion));
    return response;
  }
  return err("scene portrait changed", 409);
}
