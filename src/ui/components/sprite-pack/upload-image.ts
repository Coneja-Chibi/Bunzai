/** Reads a SpritePack image through the owning staged-upload callback when one is provided. */
import type { AssetUpload } from "../../_shared/asset-upload";

export async function readSpriteImage(
  file: File, upload?: AssetUpload, signal?: AbortSignal, onReceipt?: (receipt: string) => void,
): Promise<{ ref: string; mime?: string }> {
  if (upload) {
    const asset = await upload(file, signal);
    onReceipt?.(asset.receipt);
    return asset;
  }
  const ref = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("sprite-pack: expected data URL"));
    reader.onerror = () => reject(new Error("sprite-pack: read failed"));
    reader.readAsDataURL(file);
  });
  const mime = file.type.startsWith("image/") ? file.type : undefined;
  return { ref, ...(mime ? { mime } : {}) };
}
