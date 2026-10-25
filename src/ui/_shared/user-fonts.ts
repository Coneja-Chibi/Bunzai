/** Loads a user font from bounded in-memory asset bytes; never evaluates a user URL or CSS source. */
import { artCache } from "./art-cache";
import { isSha256Hex } from "../../core/sha256";

const MAX_FACES = 64;
const MAX_TRACKED_ASSETS = 512;
const faces = new Map<string, FontFace>();
let generation = 0;
const assetGeneration = new Map<string, number>();

function dropAssetFonts(sha: string): void {
  assetGeneration.set(sha, (assetGeneration.get(sha) ?? 0) + 1);
  for (const [key, face] of faces) {
    if (!key.startsWith(`${sha}\u0000`)) continue;
    document.fonts.delete(face);
    faces.delete(key);
  }
  while (assetGeneration.size > MAX_TRACKED_ASSETS) assetGeneration.delete(assetGeneration.keys().next().value as string);
}

function clearUserFonts(): void {
  generation++;
  for (const face of faces.values()) document.fonts.delete(face);
  faces.clear();
}

artCache.onClear(clearUserFonts);
artCache.onDrop((identity) => {
  const sha = identity.startsWith("sha:") && identity[68] === ":" ? identity.slice(4, 68) : "";
  if (isSha256Hex(sha)) dropAssetFonts(sha);
});

export async function loadUserFont(sha: string, family: string): Promise<FontFace> {
  if (!isSha256Hex(sha) || !family.trim() || family.length > 128 || /[\u0000-\u001f\u007f]/.test(family)) {
    throw new Error("invalid user font identity");
  }
  const key = `${sha}\u0000${family}`;
  const cached = faces.get(key);
  if (cached) { faces.delete(key); faces.set(key, cached); return cached; }
  const openedAt = generation;
  const openedAssetAt = assetGeneration.get(sha) ?? 0;
  const blob = await artCache.getBlob(`/api/asset/${sha}?size=full`, `sha:${sha}:full`);
  const face = new FontFace(family, await blob.arrayBuffer());
  await face.load();
  if (openedAt !== generation || openedAssetAt !== (assetGeneration.get(sha) ?? 0)) {
    face.status === "loaded" && document.fonts.delete(face);
    throw new Error("asset cache changed while loading font");
  }
  document.fonts.add(face);
  faces.set(key, face);
  while (faces.size > MAX_FACES) {
    const oldest = faces.keys().next().value as string | undefined;
    if (!oldest) break;
    const evicted = faces.get(oldest);
    faces.delete(oldest);
    if (evicted) document.fonts.delete(evicted);
  }
  return face;
}
