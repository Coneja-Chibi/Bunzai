/** Dramaturg stream input is decoded before a terminal event can replace the conversation projection. */
import { expect, test } from "bun:test";
import { readDramaturgStream, refusalOf } from "./dramaturg-stream";
import type { DramaturgStreamEvent } from "../../../../app-contract-dramaturg";

test("refusals preserve the status and code inside the byte cap", async () => {
  const message = "x".repeat(65_536 - JSON.stringify({ error: "", code: "busy" }).length);
  const text = JSON.stringify({ error: message, code: "busy" });
  expect(new TextEncoder().encode(text).length).toBe(65_536);
  const error = await refusalOf(new Response(text, { status: 409 }));
  expect(error.status).toBe(409);
  expect(error.code).toBe("busy");
  expect(error.message).toBe(message);
});

test("an oversized refusal cancels the source and returns a bounded fallback", async () => {
  let cancelled = false;
  let pulls = 0;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulls++ === 0) controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: "x".repeat(65_536) })));
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }), { status: 502 });
  const error = await refusalOf(response);
  expect(error.message).toBe("request failed (502)");
  expect(error.status).toBe(502);
  expect(cancelled).toBe(true);
});

test("malformed and unknown terminal payloads cannot claim a saved conversation", async () => {
  for (const value of [{ type: "done" }, { type: "done", thread: { revision: 1, settings: {}, entries: "bad" } }, { type: "text", delta: 5 }, { type: "done", thread: { revision: 1, settings: {}, entries: [] }, unknown: true }]) {
    const events: DramaturgStreamEvent[] = [];
    await readDramaturgStream(new Response(`event: done\ndata: ${JSON.stringify(value)}\n\n`), (event) => events.push(event));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "failed" });
  }
});
