/** Dramaturg stream input is decoded before a terminal event can replace the conversation projection. */
import { expect, test } from "bun:test";
import { readDramaturgStream } from "./dramaturg-stream";
import type { DramaturgStreamEvent } from "../../../../app-contract-dramaturg";

test("malformed and unknown terminal payloads cannot claim a saved conversation", async () => {
  for (const value of [{ type: "done" }, { type: "done", thread: { revision: 1, settings: {}, entries: "bad" } }, { type: "text", delta: 5 }, { type: "done", thread: { revision: 1, settings: {}, entries: [] }, unknown: true }]) {
    const events: DramaturgStreamEvent[] = [];
    await readDramaturgStream(new Response(`event: done\ndata: ${JSON.stringify(value)}\n\n`), (event) => events.push(event));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "failed" });
  }
});
