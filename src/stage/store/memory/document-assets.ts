/** Bounded opaque asset reads over the memory backend's existing shared blob map. The digest's shape is checked once, by the content store's interface; a key that is not held is simply missing. */
import type { BlobPayload, DocumentBackend } from "../../contracts/content-store";

export function memoryAssetReads(blobs: ReadonlyMap<string, BlobPayload>): Pick<DocumentBackend, "asset" | "assetSize"> {
  return {
    async asset(sha, maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) return { status: "missing" };
      const payload = blobs.get(sha);
      if (!payload) return { status: "missing" };
      const size = payload.kind === "bytes" ? payload.bytes.byteLength : Buffer.byteLength(payload.text, "utf8");
      if (size > maxBytes) return { status: "too-large" };
      const bytes = payload.kind === "bytes" ? payload.bytes : Buffer.from(payload.text, "utf8");
      return { status: "ok", bytes: new Uint8Array(bytes) };
    },
    async assetSize(sha) {
      const payload = blobs.get(sha);
      return payload ? { status: "ok", bytes: payload.kind === "bytes" ? payload.bytes.byteLength : Buffer.byteLength(payload.text, "utf8") } : { status: "missing" };
    },
  };
}
