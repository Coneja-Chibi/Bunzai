/**
 * Printing a stored Sprite pack as a ZIP of its pictures, by reference: the pack's light read names each
 * picture by its content hash, and each picture is read from the library only when its turn in the archive
 * comes. Nothing here ever holds the pack as one value, so a pack of any picture weight costs about one
 * picture of memory. Runtime-neutral, shared by the desktop server and the browser Studio.
 */
import { base64ToBytes } from "../../core/base64";
import { isRecord, recOr } from "../../core/guards";
import { IMAGE_MAX_BYTES, imageLimitLabel } from "../../core/media/image-limit";
import { ASSET_MAX_BYTES } from "../../core/media/limits";
import { mimeFromDataUri } from "../../core/media/mime";
import { packEntryNames, zipStored, type PackZipEntry } from "../../core/media/pack-zip";
import { mediaBlobReference } from "../../entities/piece-parts-blob";
import type { StudioStoreLike } from "../../studio/contracts";


export class PackExportError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "PackExportError";
  }
}

/**
 * Checks every picture is there and bounded, then returns the archive as a stream of chunks. The archive streams out a
 * picture at a time, so only one picture has a limit (the image limit); the archive itself has none.
 */
export async function openPackZip(store: StudioStoreLike, id: string): Promise<AsyncGenerator<Uint8Array>> {
  if (!store.readLight || !store.readAsset || !store.assetSize) throw new PackExportError("pack export is unavailable here", 501);
  const light = await store.readLight("pack", id);
  const body = isRecord(light?.entity) ? light.entity.body : undefined;
  const pack = isRecord(body) ? body.pack : undefined;
  const items = isRecord(pack) && Array.isArray(pack.items) ? pack.items : null;
  if (!light || !items) throw new PackExportError("pack not found", 404);
  if (items.length === 0) throw new PackExportError("this pack has no pictures to print");

  const entries: { label: string; mime: string; bytes(): Promise<Uint8Array> }[] = [];
  for (const raw of items) {
    const item = recOr(raw);
    const label = typeof item.label === "string" ? item.label : "";
    const ref = typeof item.ref === "string" ? item.ref : "";
    const stored = mediaBlobReference(ref);
    if (stored) {
      const size = await store.assetSize(stored.sha);
      if (size.status !== "ok") throw new PackExportError(`"${label}" is missing its picture, so this pack cannot be printed`);
      const mime = stored.mime ?? (typeof item.mime === "string" ? item.mime : "image/png");
      // A picture has the image limit; a clip or a sound file (a backdrop video, a Mood Music track) has the media cap.
      const cap = mime.startsWith("image/") ? IMAGE_MAX_BYTES : ASSET_MAX_BYTES;
      if (size.bytes > cap) throw new PackExportError(`"${label}" is larger than ${cap === IMAGE_MAX_BYTES ? imageLimitLabel() : `${String(cap / 1024 / 1024)} MB`}, so this pack cannot be printed`);
      entries.push({
        label, mime,
        bytes: async () => {
          const read = await store.readAsset!(stored.sha, cap);
          if (read.status !== "ok") throw new PackExportError(`"${label}" could not be read, so this pack cannot be printed`);
          return read.bytes;
        },
      });
      continue;
    }
    const inline = /^data:[^;,]+;base64,(.*)$/s.exec(ref);
    const mime = mimeFromDataUri(ref);
    if (!inline || !mime) throw new PackExportError(`"${label}" is not a stored picture, so this pack cannot be printed`);
    const bytes = base64ToBytes(inline[1]!);
    entries.push({ label, mime, bytes: async () => bytes });
  }

  const names = packEntryNames(entries);
  const zipEntries: PackZipEntry[] = entries.map((entry, i) => ({ name: names[i]!, bytes: entry.bytes }));
  return zipStored(zipEntries);
}
