/**
 * Import expression images from a ZIP into a SpritePack. Pure after bytes are in hand.
 * Label = image basename. Uses bounded unzip (PACK_ARCHIVE_BOUNDS).
 */
import {
  labelFromFilename,
  newPackItemId,
  normalizePack,
  type SpritePackValue,
} from "./pack";
import { ArchiveLimitError, isArchiveLimitError, PACK_ARCHIVE_BOUNDS, unzipBounded } from "../archive";
import { IMAGE_MAX_BYTES } from "./image-limit";
import { ASSET_MAX_BYTES } from "./limits";
import { bytesToBase64 } from "../base64";
import { extensionOf, mimeFromExt } from "./mime";
import { isPackMediaName, isPackPictureName } from "./pack-picture";

const mb = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`;

/**
 * What a refused zip of pictures says in plain words: that it is too large, which budget it broke, and
 * what the limit is. `archiveBytes` is the file's own size, when the caller has it.
 */
export function packZipLimitMessage(error: ArchiveLimitError, archiveBytes?: number): string {
  const limit = error.limit ?? PACK_ARCHIVE_BOUNDS.maxArchiveBytes;
  switch (error.kind) {
    case "archive-size":
      return `This zip of pictures${archiveBytes ? ` is ${mb(archiveBytes)}, which` : ""} is too large. A picture pack can be up to ${mb(limit)} as one zip; split the pictures into two zips and import each.`;
    case "entry-size":
      return `One picture in this zip is too large. A single picture can be up to ${mb(limit)}.`;
    case "entries":
      return `This zip holds more than ${limit} pictures, which is too many for one pack. Split them into smaller zips.`;
    default:
      return `The pictures in this zip add up to more than ${mb(PACK_ARCHIVE_BOUNDS.maxAggregateOriginal)}, which is too large. Split them into two zips and import each.`;
  }
}

/**
 * @param zipBytes raw zip
 * @param base existing pack to merge into
 */
export function packFromZipBytes(
  zipBytes: Uint8Array,
  base?: SpritePackValue,
): SpritePackValue {
  const existing = normalizePack(base ?? { items: [] });
  const added = packImageFilesFromZipBytes(zipBytes).map(({ label, mime, bytes }) => ({
    id: newPackItemId(), label, mime,
    ref: `data:${mime};base64,${bytesToBase64(bytes)}`,
  }));
  return normalizePack({
    ...existing,
    items: [...existing.items, ...added],
    defaultLabel: existing.defaultLabel ?? added[0]?.label,
  });
}

/**
 * A pack zip holds pictures and sounds, the two things the Press prints. Pictures keep the picture limit and a sound the media cap
 * (limits.ts), so the room per entry is the larger one and the filter holds a picture to its own.
 */
const PACK_READ_BOUNDS = { ...PACK_ARCHIVE_BOUNDS, maxEntryCompressed: ASSET_MAX_BYTES, maxEntryOriginal: ASSET_MAX_BYTES };

/** Bounded ZIP extraction for editor-owned upload routes; bytes remain local until staged. A sound comes back with an audio mime. */
export function packImageFilesFromZipBytes(zipBytes: Uint8Array): { label: string; mime: string; bytes: Uint8Array }[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipBounded(zipBytes, {
      bounds: PACK_READ_BOUNDS,
      filter: (file) => {
        if (!isPackMediaName(file.name)) return false;
        const size = Math.max(file.originalSize ?? 0, file.size);
        if (isPackPictureName(file.name) && size > IMAGE_MAX_BYTES) throw new ArchiveLimitError("archive entry exceeds safety limits", "entry-size", IMAGE_MAX_BYTES);
        return true;
      },
    });
  } catch (e) {
    if (isArchiveLimitError(e)) throw e;
    return [];
  }

  const added: { label: string; mime: string; bytes: Uint8Array }[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (!data || data.length === 0) continue;
    const baseName = path.replace(/\\/g, "/").split("/").pop() ?? path;
    const ext = extensionOf(baseName);
    const label = labelFromFilename(baseName);
    const mime = mimeFromExt(ext) ?? "application/octet-stream";
    added.push({ label, mime, bytes: data });
  }
  return added;
}
