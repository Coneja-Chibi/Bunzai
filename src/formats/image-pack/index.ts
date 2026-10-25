/**
 * Image pack codec: a ZIP of pictures (and nothing else) read into a Sprite pack, one item per image, labeled by file
 * name. It is how a folder of pictures, such as SillyTavern's `backgrounds/` (zip the folder), comes into the library
 * through the same import door as every piece (a printed Mood Music pack comes back too: sounds are read like pictures, held to the media cap); scenes then pick from the pack as their backdrop. The images ride as
 * the pack's own item refs, which the library seals on save, so nothing is kept beside them. Reading shares the
 * Sprite pack editor's ZIP rules (core/media/zip-import.ts): bounded unzip, png/jpg/gif/webp only. A ZIP that holds
 * anything else (a card, a manifest, a document) is not claimed, so a .charx or a backup never reads as a pack.
 */
import { zipSync } from "fflate";
import type { AdapterInput, AdapterOutput, PackAdapter } from "../../core/adapter";
import { ArchiveLimitError, isArchiveLimitError, PACK_ARCHIVE_BOUNDS, unzipBounded } from "../../core/archive";
import { base64ToBytes } from "../../core/base64";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { packFromZipBytes } from "../../core/media";
import { packZipLimitMessage } from "../../core/media/zip-import";
import { packEntryNames } from "../../core/media/pack-zip";
import type { CanonicalPack } from "../../entities/pack/schema";
import { isZipBytes } from "../../core/bytes";
import { isPackMediaName, isPackPictureJunk } from "../../core/media/pack-picture";

const FORMAT_ID = "image-pack";

const baseName = (path: string): string => path.replaceAll("\\", "/").split("/").pop() ?? path;

/**
 * Listing names inflates nothing, so it may look at any file a door hands an adapter (and any entry count a
 * ZIP can hold): a zip of pictures over the PACK limits is still recognised, and the read says which one it broke.
 */
const LISTING_BOUNDS = { ...PACK_ARCHIVE_BOUNDS, maxEntries: 65_535 };

/** The entry names of a ZIP, read without inflating anything; null when it is not a ZIP we can list. */
function entryNames(bytes: Uint8Array): string[] | null {
  if (!isZipBytes(bytes)) return null;
  const names: string[] = [];
  try {
    unzipBounded(bytes, { bounds: LISTING_BOUNDS, filter: (f) => { names.push(f.name); return false; } });
  } catch {
    return null;
  }
  return names;
}

/** The pictures and sounds of a ZIP that holds only those (junk aside), or null when it holds anything else or nothing. */
function onlyImages(bytes: Uint8Array | undefined): string[] | null {
  const names = bytes ? entryNames(bytes)?.filter((n) => !isPackPictureJunk(n)) : null;
  return names && names.length > 0 && names.every(isPackMediaName) ? names : null;
}

const imagePack: PackAdapter = {
  id: FORMAT_ID,
  label: "Pack (zip of pictures and sounds)",
  outputExtensions: ["zip"],
  kind: "pack",

  detect(input: AdapterInput): number {
    return onlyImages(input.bytes) ? 0.6 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPack {
    const names = onlyImages(input.bytes);
    if (!input.bytes || !names) throw new Error("image-pack: not a ZIP of pictures");
    const stem = baseName(input.filename ?? "").replace(/\.[^.]*$/, "").trim();
    const name = stem || "Image pack";
    let pack;
    try { pack = packFromZipBytes(input.bytes); }
    catch (error) {
      // The reading bounds are the pack bounds; say which one this zip broke, in the user's words.
      if (isArchiveLimitError(error)) throw new ArchiveLimitError(packZipLimitMessage(error, input.bytes.length), error.kind, error.limit, true);
      throw error;
    }
    if (pack.items.length === 0) throw new Error("image-pack: the ZIP holds no readable pictures");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "pack",
      id: canonicalId(name),
      body: { name, pack },
      original: { [FORMAT_ID]: { raw: { files: names } } },
    };
  },

  fromCanonical(entity: CanonicalPack): AdapterOutput {
    const pictures = entity.body.pack.items.map((item) => {
      const match = /^data:((?:image|audio)\/[a-z0-9.+-]+);base64,(.*)$/i.exec(item.ref);
      if (!match) throw new Error(`image-pack: "${item.label}" is not an inline picture or sound, so this pack cannot be written as a ZIP`);
      return { label: item.label, mime: match[1]!, bytes: base64ToBytes(match[2]!) };
    });
    // Names are decided together, so no two pictures can take one file; level 0 because pictures are already compressed.
    const names = packEntryNames(pictures);
    const files: Record<string, Uint8Array> = {};
    pictures.forEach((picture, i) => { files[names[i]!] = picture.bytes; });
    return { bytes: zipSync(files, { level: 0 }), suggestedExtension: "zip" };
  },
};

export default imagePack;
