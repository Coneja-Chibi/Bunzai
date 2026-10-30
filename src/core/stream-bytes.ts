/**
 * The byte pump: the one place a web stream is read with a cap. It moves a stream's bytes into a sink
 * (memory, a file, sealed ciphertext, a hash) and ALWAYS lets go of the source, whether the read ends,
 * passes its cap, errors, is aborted, or the sink throws: the stream is cancelled in a `finally`, so a
 * hostile or runaway sender never keeps sending into a discarded buffer and no lock is left held.
 * Runtime-neutral (no Node or Bun APIs) so the engine, the formats and the browser share it; the file
 * sinks live in src/ui/server-body.ts. `src/stream-doors.test.ts` keeps `getReader` out of every other file.
 */

export interface ByteSink {
  write(chunk: Uint8Array): void | Promise<void>;
  /** The source ended inside the cap: flush and close. */
  finish(): void | Promise<void>;
  /** The pump stopped early (cap, error, abort): release what the sink holds. Never throws. */
  abort(): void | Promise<void>;
}

export type PumpResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: "too-large" | "aborted" | "failed"; error?: unknown };

export interface PumpOptions {
  /** Hard cap on the bytes read; the chunk that crosses it is never written. */
  limit: number;
  signal?: AbortSignal;
  /** Called with the running total after each chunk is written. */
  onProgress?: (total: number) => void;
}

const quietly = (run: () => unknown): Promise<void> => Promise.resolve().then(run).then(() => undefined, () => undefined);

/**
 * The chunks of a stream, one at a time. Leaving the loop early, by break, throw or an abort, cancels
 * the stream; an abort also wakes a read that is waiting on a silent source.
 */
export async function* chunksOf(source: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<Uint8Array> {
  const reader = source.getReader();
  const cancel = (): void => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError");
      const { done, value } = await reader.read();
      if (signal?.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError");
      if (done) return;
      yield value;
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    // Bun 1.3: on a served request body, releaseLock after cancel throws inside Bun itself. The lock
    // only guards this reader, which is finished either way, so a failed release changes nothing.
    try { reader.releaseLock(); } catch { /* see above */ }
  }
}

/** Read `source` into `sink` under `opts.limit`. Never throws: the outcome is the result. */
export async function pumpStream(source: ReadableStream<Uint8Array> | null, sink: ByteSink, opts: PumpOptions): Promise<PumpResult> {
  let total = 0;
  let failure: Extract<PumpResult, { ok: false }> | null = null;
  try {
    if (source) {
      for await (const chunk of chunksOf(source, opts.signal)) {
        if (chunk.byteLength === 0) continue;
        if (total + chunk.byteLength > opts.limit) { failure = { ok: false, reason: "too-large" }; break; }
        total += chunk.byteLength;
        await sink.write(chunk);
        opts.onProgress?.(total);
      }
    }
    if (!failure) {
      opts.signal?.throwIfAborted();
      await sink.finish();
    }
  } catch (error) {
    failure = { ok: false, reason: opts.signal?.aborted ? "aborted" : "failed", error };
  }
  if (!failure) return { ok: true, bytes: total };
  await quietly(() => sink.abort());
  return failure;
}

/** Collects bytes into one array. With a size hint (a content-length) the common case keeps one buffer and one copy. */
export function memorySink(sizeHint = 0): ByteSink & { bytes(): Uint8Array } {
  const head = new Uint8Array(Math.max(0, sizeHint));
  let at = 0;
  const rest: Uint8Array[] = [];
  let restBytes = 0;
  return {
    write(chunk) {
      if (rest.length === 0 && at + chunk.byteLength <= head.byteLength) { head.set(chunk, at); at += chunk.byteLength; return; }
      rest.push(chunk);
      restBytes += chunk.byteLength;
    },
    finish() {},
    abort() { rest.length = 0; },
    bytes() {
      if (rest.length === 0 && at === head.byteLength) return head;
      const out = new Uint8Array(at + restBytes);
      out.set(head.subarray(0, at));
      let offset = at;
      for (const chunk of rest) { out.set(chunk, offset); offset += chunk.byteLength; }
      return out;
    },
  };
}

/** The whole stream as bytes, or why not. A null body is an empty success. */
export async function readStreamCapped(
  source: ReadableStream<Uint8Array> | null,
  limit: number,
  opts: Omit<PumpOptions, "limit"> & { sizeHint?: number } = {},
): Promise<{ ok: true; bytes: Uint8Array } | Extract<PumpResult, { ok: false }>> {
  const sink = memorySink(opts.sizeHint);
  const result = await pumpStream(source, sink, { ...opts, limit });
  return result.ok ? { ok: true, bytes: sink.bytes() } : result;
}
