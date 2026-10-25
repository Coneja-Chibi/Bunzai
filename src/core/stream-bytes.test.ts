/** The byte pump: a capped read of a stream that always lets go of the source, whatever ends it. */
import { expect, test } from "bun:test";
import { chunksOf, memorySink, pumpStream, readStreamCapped, type ByteSink } from "./stream-bytes";

/** A stream of `chunks` (then end, forever, or an error) that records whether the consumer cancelled it. */
function spied(chunks: Uint8Array[], then: "end" | "forever" | Error = "end") {
  const state = { cancelled: false, pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks[state.pulled++];
      if (next) return controller.enqueue(next);
      if (then === "end") return controller.close();
      if (then instanceof Error) return controller.error(then);
      controller.enqueue(new Uint8Array(4)); // never ends: only a cancel stops the producer
    },
    cancel() { state.cancelled = true; },
  });
  return { stream, state };
}
const bytes = (n: number, fill = 1): Uint8Array => new Uint8Array(n).fill(fill);
const recorder = (): ByteSink & { events: string[]; total: number } => {
  const events: string[] = [];
  return { events, total: 0, write(c) { this.total += c.byteLength; events.push("write"); }, finish() { events.push("finish"); }, abort() { events.push("abort"); } };
};

test("a stream under the cap lands in memory in order", async () => {
  const { stream } = spied([bytes(3, 1), bytes(2, 2)]);
  expect(await readStreamCapped(stream, 10)).toEqual({ ok: true, bytes: Uint8Array.of(1, 1, 1, 2, 2) });
});

test("a size hint keeps one buffer, and a wrong hint still gives the right bytes", async () => {
  for (const hint of [5, 2, 50]) {
    const sink = memorySink(hint);
    await sink.write(bytes(3, 1));
    await sink.write(bytes(2, 2));
    expect(Array.from(sink.bytes())).toEqual([1, 1, 1, 2, 2]);
  }
});

test("passing the cap cancels the source, aborts the sink and reports too-large without writing the overflow", async () => {
  const { stream, state } = spied([bytes(4), bytes(4), bytes(4)], "forever");
  const sink = recorder();
  const result = await pumpStream(stream, sink, { limit: 6 });
  expect(result).toMatchObject({ ok: false, reason: "too-large" });
  expect(state.cancelled).toBe(true);
  expect(sink.total).toBe(4);
  expect(sink.events.at(-1)).toBe("abort");
});

test("a source that errors reports failed with the error", async () => {
  const boom = new Error("boom");
  const sink = recorder();
  expect(await pumpStream(spied([bytes(1)], boom).stream, sink, { limit: 10 })).toMatchObject({ ok: false, reason: "failed", error: boom });
  expect(sink.events.at(-1)).toBe("abort");
});

test("a sink that throws cancels the source and reports failed", async () => {
  const { stream, state } = spied([bytes(1), bytes(1)], "forever");
  const full = new Error("disk full");
  const result = await pumpStream(stream, { write() { throw full; }, finish() {}, abort() {} }, { limit: 10 });
  expect(result).toMatchObject({ ok: false, reason: "failed", error: full });
  expect(state.cancelled).toBe(true);
});

test("an abort signal stops a read waiting on a silent source, cancels it and reports aborted", async () => {
  const state = { cancelled: false };
  const silent = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}), cancel() { state.cancelled = true; } });
  const controller = new AbortController();
  const sink = recorder();
  const pending = pumpStream(silent, sink, { limit: 10, signal: controller.signal });
  controller.abort();
  expect(await pending).toMatchObject({ ok: false, reason: "aborted" });
  expect(state.cancelled).toBe(true);
  expect(sink.events).toEqual(["abort"]);
});

test("an already-aborted signal reports aborted and cancels the source", async () => {
  const { stream, state } = spied([bytes(1)]);
  expect(await pumpStream(stream, recorder(), { limit: 10, signal: AbortSignal.abort() })).toMatchObject({ ok: false, reason: "aborted" });
  expect(state.cancelled).toBe(true);
});

test("a null body is an empty success", async () => {
  expect(await readStreamCapped(null, 10)).toEqual({ ok: true, bytes: new Uint8Array(0) });
});

test("a refused cancel never hides the real outcome", async () => {
  const stream = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(bytes(8)), cancel() { throw new Error("cancel refused"); } });
  expect(await readStreamCapped(stream, 4)).toMatchObject({ ok: false, reason: "too-large" });
});

test("progress reports the running total", async () => {
  const seen: number[] = [];
  await readStreamCapped(spied([bytes(3), bytes(2)]).stream, 10, { onProgress: (n) => seen.push(n) });
  expect(seen).toEqual([3, 5]);
});

test("a consumer that stops early cancels the source", async () => {
  const { stream, state } = spied([bytes(1), bytes(1), bytes(1)]);
  for await (const _ of chunksOf(stream)) break;
  expect(state.cancelled).toBe(true);
});
