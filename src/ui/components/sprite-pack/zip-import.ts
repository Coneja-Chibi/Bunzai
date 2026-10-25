/** Bounded SpritePack ZIP admission and staged image extraction. */
import { PACK_ARCHIVE_BOUNDS } from "../../../core/archive";
import { ASSET_BATCH_COUNT } from "../../../core/media/limits";
import { extFromMime } from "../../../core/media/mime";
import { newPackItemId, normalizePack, packFromZipBytes, packImageFilesFromZipBytes, type SpritePackValue } from "../../../core/media";
import type { AssetBatchUpload, AssetUpload } from "../../_shared/asset-upload";

export async function importSpriteZip(
  file: File, pack: SpritePackValue, upload: AssetUpload | undefined, batch: AssetBatchUpload | undefined,
  signal: AbortSignal, onReceipt?: (receipt: string) => void,
  discard?: (receipts: readonly string[]) => Promise<void>,
): Promise<{ pack?: SpritePackValue; note?: string }> {
  if (file.size > PACK_ARCHIVE_BOUNDS.maxArchiveBytes) return { note: `This zip is too large: a picture pack can be up to ${PACK_ARCHIVE_BOUNDS.maxArchiveBytes / 1024 / 1024} MB as one zip. No files were imported.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal.aborted) return { note: "ZIP import canceled; no files were imported." };
  if (!upload) return { pack: packFromZipBytes(bytes, pack) };
  const files = packImageFilesFromZipBytes(bytes);
  if (signal.aborted) return { note: "ZIP import canceled; no files were imported." };
  if (!files.length) return { note: "ZIP contains no supported picture or sound files; nothing was imported." };
  if (files.length > ASSET_BATCH_COUNT || !batch) return { note: `ZIP contains ${files.length} images; this editor admits one complete batch of up to ${String(ASSET_BATCH_COUNT)}. No files were imported.` };
  const selected = files.map(({ label, mime, bytes: image }) => {
    const buffer = new ArrayBuffer(image.byteLength);
    new Uint8Array(buffer).set(image);
    return new File([buffer], `${label}.${extFromMime(mime) ?? "png"}`, { type: mime });
  });
  const grants = await batch(selected, signal);
  grants.forEach((grant) => onReceipt?.(grant.receipt));
  if (signal.aborted) {
    await discard?.(grants.map((grant) => grant.receipt));
    return { note: "ZIP import canceled; no files were imported." };
  }
  const additions = files.map(({ label, mime }, index) => ({ id: newPackItemId(), label, ref: grants[index]!.ref, mime }));
  return { pack: normalizePack({ ...pack, items: [...pack.items, ...additions], defaultLabel: pack.defaultLabel ?? additions[0]?.label }) };
}
