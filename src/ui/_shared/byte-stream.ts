/**
 * Chunks out as a response body, the output half of the byte pump (src/core/stream-bytes.ts). One place
 * turns an async stream of archive chunks into a `ReadableStream` a `Response` can carry, and one place sets
 * the headers every download route shares. Runtime-neutral: the desktop server and the browser Studio both use it.
 */

/** A byte stream a Response can carry, pulling one chunk at a time; a reader that walks away closes the generator. */
export function streamOf(chunks: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() { await chunks.return(undefined); },
  });
}

/** A streamed file answer: never cached, never sniffed. */
export function downloadResponse(chunks: AsyncGenerator<Uint8Array>, options: { type: string }): Response {
  return new Response(streamOf(chunks), {
    headers: { "content-type": options.type, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
