/**
 * Named multipurpose assets hub (Risu additional assets: image/audio/video/font/css).
 * Pure: no React, no format ids.
 */
import { isRecord, str } from "../guards";
import { extensionOf, extFromMime, IMAGE_EXTENSIONS, mimeFromDataUri } from "./mime";

export type NamedAssetKind = "image" | "audio" | "video" | "font" | "css" | "other";

export type NamedAsset = {
  id: string;
  name: string;
  ref: string;
  kind: NamedAssetKind;
  mime?: string;
  ext?: string;
};

export type NamedAssetsValue = {
  items: readonly NamedAsset[];
};


const AUDIO = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const VIDEO = new Set(["mp4", "webm", "mov", "mkv"]);
const FONT = new Set(["ttf", "otf", "woff", "woff2"]);
const CSS = new Set(["css"]);

export const emptyNamed = (): NamedAssetsValue => ({ items: [] });

export const newNamedId = (): string =>
  `na_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function extFromNameOrRef(name: string, ref: string): string {
  const fromName = extensionOf(name);
  if (fromName && fromName.length <= 5) return fromName;
  const path = ref.split("?")[0] ?? ref;
  if (path.startsWith("data:")) {
    const fromMime = extFromMime(mimeFromDataUri(path));
    if (fromMime) return fromMime;
  }
  const ext = extensionOf(path);
  return ext.length <= 5 ? ext : "";
}

export function kindFromExt(ext: string): NamedAssetKind {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (IMAGE_EXTENSIONS.has(e)) return "image";
  if (AUDIO.has(e)) return "audio";
  if (VIDEO.has(e)) return "video";
  if (FONT.has(e)) return "font";
  if (CSS.has(e)) return "css";
  return "other";
}

export function kindFromMime(mime: string | undefined): NamedAssetKind | null {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("font") || mime.includes("woff") || mime.includes("ttf")) return "font";
  if (mime.includes("css")) return "css";
  return null;
}

/** Fail closed: require name + ref; unique names (last wins). */
export function normalizeNamed(value: unknown): NamedAssetsValue {
  if (!isRecord(value)) return emptyNamed();
  const v = value;
  const raw = Array.isArray(v.items) ? v.items : [];
  const byName = new Map<string, NamedAsset>();
  for (const row of raw) {
    if (!isRecord(row)) continue;
    const r = row;
    const name = str(r.name).trim();
    const ref = str(r.ref).trim();
    if (!name || !ref) continue;
    const id = str(r.id).trim() || newNamedId();
    const mime = str(r.mime).trim() || undefined;
    const ext = str(r.ext).trim() || extFromNameOrRef(name, ref);
    const kind =
      (str(r.kind) as NamedAssetKind) &&
      ["image", "audio", "video", "font", "css", "other"].includes(str(r.kind))
        ? (str(r.kind) as NamedAssetKind)
        : (kindFromMime(mime) ?? kindFromExt(ext));
    const item: NamedAsset = { id, name, ref, kind };
    if (mime) item.mime = mime;
    if (ext) item.ext = ext;
    byName.set(name.toLowerCase(), item);
  }
  return { items: [...byName.values()] };
}
