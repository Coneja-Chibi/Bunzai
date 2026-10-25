/**
 * A dropped folder of pictures becomes one zip for the Library import, so the image-pack adapter reads it as one pack
 * with no zip step by hand (SillyTavern's `backgrounds` folder is the case). A folder counts when everything in it is a
 * picture and either it is named like a picture shelf or holds no png (a png is also how a character card travels, so a
 * folder of pngs not named like a shelf stays a folder of files for the usual triage). It stays under the pack zip bound
 * (core/archive.ts PACK_ARCHIVE_BOUNDS); a bigger folder is left as its files.
 */
import { zipSync } from "fflate";
import { PACK_ARCHIVE_BOUNDS } from "../../core/archive";
import { extensionOf, mimeFromExt } from "../../core/media/mime";
import { isPackPictureJunk, isPackPictureName } from "../../core/media/pack-picture";
import { packEntryNames } from "../../core/media/pack-zip";

const SHELF_NAME = /^(backgrounds?|wallpapers?|pictures?|images?)$/i;

/** The files of a folder that are content (hidden files and Thumbs.db aside), or null when it is not a picture folder. */
export function pictureFolderFiles(name: string, files: readonly File[]): File[] | null {
  const content = files.filter((f) => !isPackPictureJunk(f.name));
  if (content.length === 0 || content.length > PACK_ARCHIVE_BOUNDS.maxEntries || !content.every((f) => isPackPictureName(f.name))) return null;
  if (!SHELF_NAME.test(name) && content.some((f) => extensionOf(f.name) === "png")) return null;
  return content.reduce((n, f) => n + f.size, 0) <= PACK_ARCHIVE_BOUNDS.maxAggregateOriginal ? content : null;
}

/** The folder's pictures as `<folder>.zip`, or null when the folder is not one. */
export async function zipPictureFolder(name: string, files: readonly File[]): Promise<File | null> {
  const pictures = pictureFolderFiles(name, files);
  if (!pictures) return null;
  const names = packEntryNames(pictures.map((f) => {
    const ext = extensionOf(f.name);
    return { label: f.name.slice(0, -(ext.length + 1)), mime: mimeFromExt(ext) ?? "image/png" };
  }));
  const packed: Record<string, Uint8Array> = {};
  for (const [i, f] of pictures.entries()) packed[names[i]!] = new Uint8Array(await f.arrayBuffer());
  const bytes = zipSync(packed, { level: 0 });
  return new File([bytes.buffer as ArrayBuffer], `${name}.zip`, { type: "application/zip" });
}
