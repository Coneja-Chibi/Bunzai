/**
 * Bytes into something an `img` tag can show, once, at the boundary.
 *
 * KIT HANDS PICTURES AROUND AS BYTES on purpose: the clipboard reader and the card-art seam have
 * different sources and neither should teach the command layer how to read a file. A browser cannot
 * take bytes, so exactly one place turns them into a `data:` URL, and that place also decides how
 * big a picture is allowed to be.
 *
 * THE TYPE IS SNIFFED, NOT ASSUMED. `showImage` carries no mime - Kit's terminal renderer decodes
 * the bytes itself - so labelling everything `image/png` would hand a browser a JPEG under the wrong
 * name. Browsers mostly cope; "mostly" is not a contract, and the four signatures below are the
 * whole of what any of these sources can produce. The signatures themselves are asset-content.ts's.
 */
import { bytesToBase64 } from "../../core/base64";
import { sniffAssetMime } from "../_shared/asset-content";
import { IMAGE_MAX_BYTES } from "../../core/media/image-limit";

/**
 * How much one shelf may carry in total.
 *
 * A SECOND, DIFFERENT LIMIT, because the failure it prevents is a different one. A single picture at the image limit
 * is fine; twelve of them is a hundred-megabyte response for a strip of thumbnails nobody
 * asked to see at full size. The gallery stops when it is full and says how many it showed.
 */
export const MAX_SHELF_BYTES = 24 * 1024 * 1024;

const SHOWN_MIMES: ReadonlySet<string> = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** The image type these bytes actually are, or null when they are not an image this can show. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  // The asset door already knows every signature (and demands the whole one); this narrows it to what a model can read.
  const mime = sniffAssetMime(bytes);
  return mime !== undefined && SHOWN_MIMES.has(mime) ? mime : null;
}

/**
 * A `data:` URL for these bytes, or null when there is nothing safe to show.
 *
 * Null rather than a placeholder: a picture that cannot be drawn is a fact the command should say in
 * words, and an empty frame says it worse.
 *
 * `declared` is what the source claimed - the art seam stores a mime alongside the bytes - and it is
 * used only when it agrees with what the bytes are. A stored label is authored data.
 */
export function imageDataUrl(bytes: Uint8Array, declared?: string): string | null {
  if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) return null;
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) return null;
  const mime = declared === sniffed ? declared : sniffed;
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
