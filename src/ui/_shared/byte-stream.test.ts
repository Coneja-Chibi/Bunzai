/** Chunks out as a response body: pulled one at a time, cancelled by the reader, with the shared download headers. */
import { expect, test } from "bun:test";
import { downloadResponse, streamOf } from "./byte-stream";

async function* chunks(log: string[]): AsyncGenerator<Uint8Array> {
  try {
    for (let i = 1; i <= 3; i++) { log.push(`made ${i}`); yield Uint8Array.of(i); }
  } finally { log.push("closed"); }
}

test("the chunks come out in order, one pulled per request", async () => {
  const log: string[] = [];
  const body = await new Response(streamOf(chunks(log))).arrayBuffer();
  expect([...new Uint8Array(body)]).toEqual([1, 2, 3]);
});

test("a reader that walks away closes the generator", async () => {
  const log: string[] = [];
  const reader = streamOf(chunks(log)).getReader();
  await reader.read();
  await reader.cancel();
  expect(log.at(-1)).toBe("closed");
});

test("a download response carries one set of headers", () => {
  const res = downloadResponse(chunks([]), { type: "application/zip" });
  expect(res.headers.get("content-type")).toBe("application/zip");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});
