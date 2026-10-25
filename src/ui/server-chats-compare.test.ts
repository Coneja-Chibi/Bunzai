/** Compare takes over HTTP: two takes read from where they part; a missing take is a 404 and the same take twice a 400; nothing is written. */
import { afterEach, expect, test } from "bun:test";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

test("compare-takes answers the diverging messages and refuses bad picks", async () => {
  const r = await rig();
  await r.store.save(vera);
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const sent = (await (await r.post("/api/chats/send", { chatId: chat.id, content: "Any storms?", greetingIndex: 0, expectedVersion: 1 })).json()) as { branchVersion: number; chat: { activeBranchId: string }; messages: { id: string }[] };
  const main = sent.chat.activeBranchId;
  const forked = (await (await r.post("/api/chats/fork", { chatId: chat.id, messageId: sent.messages.at(-1)!.id, name: "Take 2", expectedVersion: sent.branchVersion })).json()) as { takes: { id: string; name: string }[] };
  const take = forked.takes.find((t) => t.name === "Take 2")!.id;
  const get = (q: string) => r.handler(apiReq(`/api/chats/compare-takes?${q}`));
  const ok = (await (await get(`chatId=${chat.id}&a=${main}&b=${take}`)).json()) as { shared: number; rows: unknown[] };
  expect(ok.shared).toBeGreaterThan(0);
  expect(ok.rows).toEqual([]);
  expect((await get(`chatId=${chat.id}&a=${main}&b=nope`)).status).toBe(404);
  expect((await get(`chatId=${chat.id}&a=${main}&b=${main}`)).status).toBe(400);
});
