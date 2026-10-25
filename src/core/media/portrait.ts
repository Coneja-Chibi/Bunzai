/**
 * Portrait / face helpers: build MediaAsset from a data URI or URL. Pure.
 */
import type { MediaAsset } from "../../entities/character/schema";
import { str } from "../guards";
import { extOf, mimeFromDataUri, mimeFromExt } from "./mime";

export { mimeFromDataUri };

/** A URL's MIME type by extension (query string ignored); undefined when unrecognized. */
export const mimeFromUrl = (url: string): string | undefined => mimeFromExt(extOf(url));

/** Build a primary portrait asset. Empty ref -> null (fail closed). */
export function portraitFromRef(ref: string, mime?: string): MediaAsset | null {
  const r = str(ref).trim();
  if (!r) return null;
  const out: MediaAsset = { role: "portrait", ref: r, primary: true };
  const m =
    mime ??
    (r.startsWith("data:") ? mimeFromDataUri(r) : mimeFromUrl(r));
  if (m) out.mime = m;
  return out;
}

/** True when ref is a usable face source for preview (data or http(s)). */
export function isPreviewablePortraitRef(ref: string): boolean {
  const r = ref.trim();
  return r.startsWith("data:image/") || r.startsWith("https://") || r.startsWith("http://");
}
