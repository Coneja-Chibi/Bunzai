/**
 * The portrait response header contract (spec: "no plaintext on disk"). Both routes that ever serve
 * decrypted art bytes - the library's `/api/studio/portrait` and a scene's frozen `/api/chats/portrait`
 * - must answer `cache-control: no-store`, or Chrome and WebView2 can still write the decoded image
 * into the browser's disk cache.
 */
import { afterEach, expect, test } from "bun:test";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const withPortrait = { ...vera, body: { ...vera.body, media: { portrait: { role: "portrait", ref: `data:image/png;base64,${PNG}`, mime: "image/png" } } } };

test("/api/studio/portrait answers no-store, never no-cache", async () => {
  const { store, handler } = await rig();
  await store.save(withPortrait);
  const res = await handler(apiReq("/api/studio/portrait?kind=character&id=vera"));
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
});

test("/api/chats/portrait (a scene's frozen art) answers no-store, never no-cache", async () => {
  const { store, handler, post } = await rig();
  await store.save(withPortrait);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const res = await handler(apiReq(`/api/chats/portrait?id=${chat.id}`));
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
