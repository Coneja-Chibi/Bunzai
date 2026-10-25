/** The scene turn stream reader: frames split across reads, a garbled frame, and a stream cut short. */
import { expect, test } from "bun:test";
import type { TurnEvent } from "../../../studio/scene-turn";
import { readSceneTurn } from "./scene-turn-stream";

const frame = (e: TurnEvent) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
const streamOf = (chunks: string[]) =>
  new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk)); c.close(); } }));

test("frames split across reads arrive whole and in order, and a garbled one is skipped", async () => {
  const all = frame({ type: "start", turnId: "t", kind: "reply", messageId: null }) + "data: {oops\n\n" + frame({ type: "text", delta: "Hi" }) + frame({ type: "stopped", message: null });
  const seen: TurnEvent[] = [];
  await readSceneTurn(streamOf([all.slice(0, 17), all.slice(17, 60), all.slice(60)]), (e) => seen.push(e));
  expect(seen.map((e) => e.type)).toEqual(["start", "text", "stopped"]);
});

test("a stream that ends before its last event says the page lost the reply, not that it failed", async () => {
  const seen: TurnEvent[] = [];
  await readSceneTurn(streamOf([frame({ type: "start", turnId: "t", kind: "reply", messageId: null })]), (e) => seen.push(e));
  expect(seen.at(-1)).toMatchObject({ type: "failed", message: expect.stringContaining("reopen the scene") });
});
