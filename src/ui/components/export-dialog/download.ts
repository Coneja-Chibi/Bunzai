/**
 * Pure helpers to turn an ExportResult into a browser download (imperative edge is the caller).
 */
import { sanitizeDownloadBase } from "../../../core/download-name";

export { triggerDownload } from "../../_shared/download-sink";

export interface ExportPayload {
  suggestedExtension: string;
  text?: string;
  bytesB64?: string;
}

/** Build a Blob + filename for a successful export payload. */
export function exportBlob(payload: ExportPayload, baseName: string): { blob: Blob; filename: string } {
  const ext = payload.suggestedExtension.replace(/^\./, "") || "bin";
  const safe = sanitizeDownloadBase(baseName, "card");
  const filename = `${safe}.${ext}`;
  if (typeof payload.text === "string") {
    return { blob: new Blob([payload.text], { type: "application/octet-stream" }), filename };
  }
  if (payload.bytesB64) {
    const bin = atob(payload.bytesB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: "application/octet-stream" }), filename };
  }
  throw new Error("export: empty payload (no text or bytes)");
}
