/** Bounded, receipt-pinned asset reads for the temporary browser Studio. */
import { assetBytesResponse } from "../ui/_shared/asset-content";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StudioStoreLike } from "../studio/contracts";
import { ASSET_ROUTE_PREFIX, assetRouteSha } from "../core/media/asset-route";
import { isSha256Hex } from "../core/sha256";
import { ASSET_MAX_BYTES } from "../core/media/limits";

const json = (value: unknown, status = 200): Response => Response.json(value, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const error = (message: string, status = 400): Response => json({ error: message }, status);
const sameReceipt = (a: { revision: string; version: number; writeId: number }, b: { revision: string; version: number; writeId: number }): boolean =>
  a.revision === b.revision && a.version === b.version && a.writeId === b.writeId;

/** Reads only the addressed hash or portrait and fences every awaited result against closure/edits. */
export async function handlePocketAsset(request: Request, url: URL, store: StudioStoreLike, chats: ChatStore, isOpen: () => boolean): Promise<Response | null> {
  const path = url.pathname;
  const sha = assetRouteSha(path);
  if (path.startsWith(ASSET_ROUTE_PREFIX) && path !== "/api/asset/upload" && path !== "/api/asset/discard") {
    if (!sha) return error("invalid asset path", 404);
    if (request.method !== "GET" && request.method !== "HEAD") return error("asset method is not supported", 405);
    if (url.searchParams.has("mime") || url.searchParams.getAll("size").length > 1) return error("invalid asset selector");
    const size = url.searchParams.get("size") ?? "full";
    if (size !== "full") return error("browser thumbnails are unavailable", 501);
    if (!store.assetSize || !store.readAsset) return error("asset storage is unavailable", 404);
    const stat = await store.assetSize(sha);
    if (!isOpen()) return error("browser studio is closed", 423);
    if (stat.status !== "ok") return error("asset not found", 404);
    if (request.method === "HEAD") return new Response(null, { headers: { "content-length": String(stat.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    if (stat.bytes > ASSET_MAX_BYTES) return error("asset exceeds the bounded browser delivery limit", 413);
    const opened = await store.readAsset(sha, ASSET_MAX_BYTES);
    if (!isOpen()) return error("browser studio is closed", 423);
    if (opened.status !== "ok") return error(opened.status === "too-large" ? "asset exceeds the bounded browser delivery limit" : "asset not found", opened.status === "too-large" ? 413 : 404);
    return assetBytesResponse(opened.bytes, sha) ?? error("unsupported asset bytes", 415);
  }
  if (path === "/api/studio/portrait-ref" || path === "/api/studio/portrait") {
    if (request.method !== "GET" && request.method !== "HEAD") return error("portrait method is not supported", 405);
    const kind = url.searchParams.get("kind") ?? "", id = url.searchParams.get("id") ?? "";
    if (!kind || !id || !store.readPortraitAsset) return error("portrait not found", 404);
    const ref = await store.readPortraitAsset(kind, id);
    if (!isOpen()) return error("browser studio is closed", 423);
    if (!ref) return error("portrait not found", 404);
    const revisions = url.searchParams.getAll("r"), writes = url.searchParams.getAll("w");
    if (revisions.length > 1 || writes.length > 1 || revisions.some((x) => !isSha256Hex(x)) || writes.some((x) => !/^\d+$/.test(x) || !Number.isSafeInteger(Number(x)))) return error("invalid portrait receipt");
    if (revisions[0] !== undefined && revisions[0] !== ref.revision || writes[0] !== undefined && Number(writes[0]) !== ref.writeId) return error("portrait changed", 409);
    if (path.endsWith("-ref")) {
      if (!isOpen()) return error("browser studio is closed", 423);
      let asset = ref.asset;
      if ("url" in asset) {
        const pinned = new URL(asset.url, request.url);
        pinned.searchParams.set("r", ref.revision);
        pinned.searchParams.set("w", String(ref.writeId));
        asset = { ...asset, url: `${pinned.pathname}${pinned.search}` };
      }
      return request.method === "HEAD" ? new Response(null, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }) : json({ ...ref, asset });
    }
    if (!store.readPortraitContent) return error("portrait storage is unavailable", 404);
    const size = "sha" in ref.asset ? await store.assetSize?.(ref.asset.sha) : { status: "ok", bytes: ref.asset.bytes ?? 0 };
    if (!isOpen()) return error("browser studio is closed", 423);
    if (!size || size.status !== "ok") return error("portrait size is unavailable", 422);
    if (request.method === "HEAD") return new Response(null, { headers: { "content-length": String(size.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    if (size.bytes > ASSET_MAX_BYTES) return error("portrait exceeds the bounded browser delivery limit", 413);
    const content = await store.readPortraitContent(kind, id);
    if (!isOpen()) return error("browser studio is closed", 423);
    const latest = await store.readPortraitAsset(kind, id);
    if (!latest || !sameReceipt(ref, latest)) return error("portrait changed", 409);
    return content && sameReceipt(ref, content) ? assetBytesResponse(content.bytes, content.sha) ?? error("unsupported portrait bytes", 415) : error("portrait changed", 409);
  }
  if (path === "/api/chats/portrait-ref" || path === "/api/chats/portrait") {
    if (request.method !== "GET" && request.method !== "HEAD") return error("portrait method is not supported", 405);
    const id = url.searchParams.get("id") ?? "", version = url.searchParams.get("v");
    const revisions = url.searchParams.getAll("r"), writes = url.searchParams.getAll("w");
    if (!id || url.searchParams.getAll("v").length > 1 || (version !== null && (!/^\d+$/.test(version) || !Number.isSafeInteger(Number(version))))) return error("invalid frozen portrait selector");
    if (revisions.length > 1 || writes.length > 1 || revisions.some((x) => !isSha256Hex(x)) || writes.some((x) => !/^\d+$/.test(x) || !Number.isSafeInteger(Number(x)))) return error("invalid portrait receipt");
    for (let attempt = 0; attempt < 3; attempt++) {
      const frozen = await chats.castPortraitRef(id);
      if (!isOpen()) return error("browser studio is closed", 423);
      if (!frozen) return error("portrait not found", 404);
      if (version !== null && Number(version) !== frozen.snapshotVersion) return error("scene portrait changed", 409);
      const chat = frozen.liveCardFallback ? await chats.getChat(id) : null;
      if (!isOpen()) return error("browser studio is closed", 423);
      if (frozen.liveCardFallback && (!chat || chat.snapshotVersion !== frozen.snapshotVersion)) continue;
      const live = chat && store.readPortraitAsset ? await store.readPortraitAsset("character", chat.cast.character.id) : null;
      if (!isOpen()) return error("browser studio is closed", 423);
      if (live && (revisions[0] !== undefined && revisions[0] !== live.revision || writes[0] !== undefined && Number(writes[0]) !== live.writeId)) return error("scene portrait changed", 409);
      const asset = frozen.liveCardFallback ? live?.asset : frozen.ref;
      let response: Response;
      if (path.endsWith("-ref")) {
        const pinned = asset && "url" in asset && live ? { ...asset, url: `/api/chats/portrait?${new URLSearchParams({ id, v: String(frozen.snapshotVersion), r: live.revision, w: String(live.writeId) })}` } : asset;
        response = request.method === "HEAD"
          ? new Response(null, { status: pinned ? 200 : 404, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } })
          : json(pinned ? { asset: pinned, snapshotVersion: frozen.snapshotVersion, ...(live ? { revision: live.revision, version: live.version, writeId: live.writeId } : {}) } : null, pinned ? 200 : 404);
      }
      else if (asset && "sha" in asset && store.assetSize && store.readAsset) {
        const size = await store.assetSize(asset.sha);
        if (!isOpen()) return error("browser studio is closed", 423);
        if (size.status !== "ok") response = error("portrait not found", 404);
        else if (request.method === "HEAD") response = new Response(null, { headers: { "content-length": String(size.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
        else if (size.bytes > ASSET_MAX_BYTES) response = error("portrait exceeds the bounded browser delivery limit", 413);
        else {
          const opened = await store.readAsset(asset.sha, ASSET_MAX_BYTES);
          if (!isOpen()) return error("browser studio is closed", 423);
          response = opened.status === "ok" ? assetBytesResponse(opened.bytes, asset.sha) ?? error("unsupported portrait bytes", 415) : error("portrait not found", 404);
        }
      } else if (asset && "url" in asset && request.method === "HEAD" && Number.isSafeInteger(asset.bytes)) {
        response = new Response(null, { headers: { "content-length": String(asset.bytes), "cache-control": "no-store", "x-content-type-options": "nosniff" } });
      } else if (chat && store.readPortraitContent && request.method === "GET") {
        const content = await store.readPortraitContent("character", chat.cast.character.id);
        if (!isOpen()) return error("browser studio is closed", 423);
        response = content && live && sameReceipt(content, live) ? assetBytesResponse(content.bytes, content.sha) ?? error("unsupported portrait bytes", 415) : error("portrait changed", 409);
      } else response = error("portrait not found", 404);
      if (chat && live && store.readPortraitAsset) {
        const latest = await store.readPortraitAsset("character", chat.cast.character.id);
        if (!isOpen()) return error("browser studio is closed", 423);
        if (!latest || !sameReceipt(latest, live)) continue;
      }
      const current = await chats.castPortraitRef(id);
      if (!isOpen()) return error("browser studio is closed", 423);
      if (!current || current.snapshotVersion !== frozen.snapshotVersion) continue;
      response.headers.set("x-snapshot-version", String(frozen.snapshotVersion));
      return response;
    }
    return error("scene portrait changed", 409);
  }
  return null;
}
