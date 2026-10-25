/**
 * The client download sink: where a streamed answer ends up in the tab. A response drains into a Blob (the
 * browser pages Blobs out of the JS heap, a `Uint8Array` of the whole archive cannot be paged), and a save
 * streams that Blob into the file the person picked when the host has `showSaveFilePicker`, or hands it to
 * an anchor download when it does not. Nothing here ever calls `arrayBuffer()` on an archive.
 */
import { pumpStream, type ByteSink } from "../../core/stream-bytes";

/** Folds pending chunks into the Blob this many bytes at a time, so the heap holds a slice, not the archive. */
const FLUSH_BYTES = 32 * 1024 * 1024;

export function blobSink(type = "application/octet-stream", flushBytes = FLUSH_BYTES): ByteSink & { blob(): Blob; pendingBytes(): number } {
  let blob = new Blob([], { type });
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  const fold = (): void => {
    if (pending.length === 0) return;
    blob = new Blob([blob, ...(pending as BlobPart[])], { type });
    pending = [];
    pendingBytes = 0;
  };
  return {
    write(chunk) {
      pending.push(chunk);
      pendingBytes += chunk.byteLength;
      if (pendingBytes >= flushBytes) fold();
    },
    finish: fold,
    abort() { pending = []; pendingBytes = 0; blob = new Blob([], { type }); },
    blob: () => blob,
    pendingBytes: () => pendingBytes,
  };
}

/** A streamed response as a Blob. No size cap: the bound is the disk, and the server already bounded what it sends. */
export async function drainToBlob(response: Response, type = response.headers.get("content-type") ?? "application/octet-stream"): Promise<Blob> {
  const sink = blobSink(type);
  const result = await pumpStream(response.body, sink, { limit: Number.POSITIVE_INFINITY });
  if (!result.ok) throw result.error instanceof Error ? result.error : new Error("the download stopped before it finished");
  return sink.blob();
}

/** A one-shot object-URL download through an anchor (DOM edge). */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface SaveHost {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;
}

/**
 * Save a Blob under `filename`. Call it from the click that asked for it (the picker needs that gesture).
 * With a picker the Blob streams to the chosen file; a cancelled picker is not an error, and a host that
 * offers a picker but refuses it (an embedded page, a policy) gets the anchor download instead.
 */
export async function saveBlob(
  blob: Blob,
  filename: string,
  io: { host?: SaveHost; anchor?: (blob: Blob, filename: string) => void } = {},
): Promise<void> {
  const host = io.host ?? (globalThis as SaveHost);
  const anchor = io.anchor ?? triggerDownload;
  if (!host.showSaveFilePicker) return anchor(blob, filename);
  let handle: Awaited<ReturnType<NonNullable<SaveHost["showSaveFilePicker"]>>>;
  try {
    handle = await host.showSaveFilePicker({ suggestedName: filename });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") return;
    return anchor(blob, filename);
  }
  await blob.stream().pipeTo(await handle.createWritable());
}
