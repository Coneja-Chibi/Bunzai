/** Draining an entry or a table must let go of the entry stream however it ends. */
import { expect, test } from "bun:test";
import { ArchiveLimitError } from "../../core/archive";
import { readNdjson } from "./ndjson";
import { readEntryBytes, type LvbakEntrySource } from "./source";

function endless(chunk: Uint8Array) {
  const state = { cancelled: false };
  const stream = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(chunk), cancel() { state.cancelled = true; } });
  return { stream, state };
}

test("an entry past its ceiling cancels the entry stream, not just the reader lock", async () => {
  const { stream, state } = endless(new Uint8Array(1024));
  const source = { open: async () => stream } as unknown as LvbakEntrySource;
  const failure = await readEntryBytes(source, "big.bin", 4096).then(() => null, (e: unknown) => e);
  expect(failure).toBeInstanceOf(ArchiveLimitError);
  expect(state.cancelled).toBe(true);
});

test("a table reader whose consumer stops early cancels the entry stream", async () => {
  const { stream, state } = endless(new TextEncoder().encode('{"a":1}\n'));
  for await (const _ of readNdjson(stream, { maxLineBytes: 1024 })) break;
  expect(state.cancelled).toBe(true);
});
