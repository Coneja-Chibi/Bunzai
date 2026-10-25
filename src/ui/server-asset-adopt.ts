/**
 * Adopting pictures the library already holds, instead of uploading them again: copying a Sprite pack onto
 * a character (or a character's faces into a pack) names existing blobs, so the client asks the server for
 * grants over those hashes and never carries the bytes. A grant is as bounded as an upload's: per session,
 * expiring, revoked by a lock, and only for a picture the library really holds (size and type checked here,
 * the bytes re-read and re-hashed when a patch spends the grant). Count and total weight are capped apart
 * from uploads, so a 40-picture pack copies whole without raising the limit on new files.
 */
import { createHash, randomBytes } from "node:crypto";
import { mediaBlobReference } from "../entities/piece-parts-blob";
import type { PartBlob } from "../stage/contracts/content-store";
import type { StudioStoreLike } from "../studio/contracts";
import { ASSET_ADOPT_BYTES, ASSET_ADOPT_COUNT, ASSET_UPLOAD_TTL } from "./_shared/asset-content";
import { ASSET_MAX_BYTES } from "../core/media/limits";
import { MIME_BY_EXT } from "../core/media/mime";
import { err, json, readJsonObject } from "./server-security";

type Grant = { session: string; sha: string; mime: string; bytes: number; expires: number; generation: number };
const adopted = new Map<string, Grant>();
let generation = 0;
const SUPPORTED = new Set(Object.values(MIME_BY_EXT));

const prune = (): void => {
  const now = Date.now();
  for (const [ref, grant] of adopted) if (grant.expires <= now) adopted.delete(ref);
};
const mine = (session: string): Grant[] => [...adopted.values()].filter((grant) => grant.session === session);

export function isAdoptedRef(ref: string): boolean {
  return adopted.has(ref);
}
export function revokeAdopted(ref: string, session: string): void {
  if (adopted.get(ref)?.session === session) adopted.delete(ref);
}
export function clearAdopted(): void {
  generation++;
  adopted.clear();
}

/** The picture a spent grant stands for, read from the library and checked against its hash. Null when `ref` is not an adopted grant. */
export async function openAdopted(ref: string, session: string, store: Pick<StudioStoreLike, "readAsset">): Promise<PartBlob | null> {
  const grant = adopted.get(ref);
  if (!grant) return null;
  if (grant.session !== session || grant.expires <= Date.now() || grant.generation !== generation) throw new Error("upload ref is missing or belongs to another session");
  const read = await store.readAsset?.(grant.sha, ASSET_MAX_BYTES);
  if (!read || read.status !== "ok" || createHash("sha256").update(read.bytes).digest("hex") !== grant.sha) throw new Error("adopted picture is no longer in the library");
  return { key: grant.sha, payload: { kind: "bytes", bytes: read.bytes } };
}

/** POST /api/asset/adopt { assets: [sentinel refs] } -> { grants: [{ ref, asset, sha, mime, bytes }] } */
export async function adoptLibraryAssets(req: Request, session: string, store: StudioStoreLike): Promise<Response> {
  if (!session) return err("authenticated local session required", 403);
  const parsed = await readJsonObject(req, 256 * 1024);
  if (!parsed.ok) return parsed.response;
  const assets = parsed.value.assets;
  if (!Array.isArray(assets) || assets.length === 0 || assets.length > ASSET_ADOPT_COUNT || assets.some((a) => typeof a !== "string")) return err("expected a bounded list of picture references", 400);
  if (!store.assetSize) return err("adopting pictures is unavailable", 501);
  prune();
  const unique = [...new Set(assets as string[])];
  const held = mine(session);
  if (held.length + unique.length > ASSET_ADOPT_COUNT) return err("too many adopted pictures", 413);
  let total = held.reduce((sum, grant) => sum + grant.bytes, 0);
  const made: [string, Grant][] = [];
  for (const asset of unique) {
    const ref = mediaBlobReference(asset);
    if (!ref?.mime || !SUPPORTED.has(ref.mime)) return err("a picture reference is not a supported picture", 400);
    const size = await store.assetSize(ref.sha);
    if (size.status !== "ok") return err("a picture is not in the library", 404);
    if (size.bytes > ASSET_MAX_BYTES) return err("a picture is too large to copy", 413);
    total += size.bytes;
    if (total > ASSET_ADOPT_BYTES) return err("these pictures are too heavy to copy at once", 413);
    made.push([asset, { session, sha: ref.sha, mime: ref.mime, bytes: size.bytes, expires: Date.now() + ASSET_UPLOAD_TTL, generation }]);
  }
  const grants = made.map(([asset, grant]) => {
    const id = randomBytes(24).toString("base64url");
    adopted.set(id, grant);
    return { ref: id, asset, sha: grant.sha, mime: grant.mime, bytes: grant.bytes };
  });
  return json({ grants });
}
