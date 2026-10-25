/** The client download sink: a response lands as a Blob without ever being one array, and a save streams to the picked file when the host can. */
import { expect, test } from "bun:test";
import { blobSink, drainToBlob, saveBlob } from "./download-sink";

const body = (...parts: number[][]): ReadableStream<Uint8Array> => new ReadableStream({
  start(controller) { for (const p of parts) controller.enqueue(Uint8Array.from(p)); controller.close(); },
});

test("a response drains to a Blob of the same bytes and type, with no size cap", async () => {
  const blob = await drainToBlob(new Response(body([1, 2], [3], [4, 5, 6])), "application/zip");
  expect(blob.type).toBe("application/zip");
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4, 5, 6]);
});

test("the Blob sink folds pending chunks into the Blob as it goes instead of holding them all", async () => {
  const sink = blobSink("application/octet-stream", 4);
  for (const n of [3, 3, 3]) await sink.write(new Uint8Array(n).fill(n));
  await sink.finish();
  expect(sink.blob().size).toBe(9);
  expect(sink.pendingBytes()).toBe(0);
});

test("a failed response never yields a half Blob", async () => {
  const broken = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(Uint8Array.of(1)); c.error(new Error("reset")); } });
  await expect(drainToBlob(new Response(broken))).rejects.toThrow("reset");
});

test("saving streams the Blob into the file the person picked", async () => {
  const written: number[] = [];
  const writable = new WritableStream<Uint8Array>({ write(chunk) { written.push(...chunk); } });
  const picked: string[] = [];
  const host = { showSaveFilePicker: async (opts: { suggestedName: string }) => { picked.push(opts.suggestedName); return { createWritable: async () => writable }; } };
  await saveBlob(new Blob([Uint8Array.of(9, 8, 7)]), "pack.zip", { host, anchor: () => { throw new Error("should not fall back"); } });
  expect(picked).toEqual(["pack.zip"]);
  expect(written).toEqual([9, 8, 7]);
});

test("without a picker the save falls back to the anchor download, and a cancelled picker does nothing", async () => {
  const anchored: string[] = [];
  await saveBlob(new Blob(["x"]), "a.zip", { host: {}, anchor: (_blob, name) => anchored.push(name) });
  expect(anchored).toEqual(["a.zip"]);
  const cancel = { showSaveFilePicker: async () => { throw new DOMException("cancelled", "AbortError"); } };
  await saveBlob(new Blob(["x"]), "b.zip", { host: cancel, anchor: (_blob, name) => anchored.push(name) });
  expect(anchored).toEqual(["a.zip"]);
});

test("a picker the host refuses falls back to the anchor download", async () => {
  const anchored: string[] = [];
  const refused = { showSaveFilePicker: async () => { throw new DOMException("not allowed here", "SecurityError"); } };
  await saveBlob(new Blob(["x"]), "c.zip", { host: refused, anchor: (_blob, name) => anchored.push(name) });
  expect(anchored).toEqual(["c.zip"]);
});
