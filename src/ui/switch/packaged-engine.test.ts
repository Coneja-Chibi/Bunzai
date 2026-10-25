/** A release download that runs past its cap is cut off, and the connection is let go. */
import { afterEach, expect, test } from "bun:test";
import { downloadAllowed } from "./packaged-engine";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("a download past the cap is refused and its stream is cancelled", async () => {
  const chunk = new Uint8Array(8 * 1024 * 1024);
  const state = { cancelled: false };
  const body = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(chunk), cancel() { state.cancelled = true; } });
  globalThis.fetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
  const failure = await downloadAllowed("https://github.com/x/y/releases/download/v1/a.exe").then(() => null, (e: unknown) => e);
  expect((failure as Error).message).toMatch(/larger than expected/);
  expect(state.cancelled).toBe(true);
});
